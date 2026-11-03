// ============================================================================
// BANC DE TEST ISOLÉ : notify-admin-payment Edge Function
// Mocks en mémoire stricts : aucune connexion externe ni donnée en production.
// ============================================================================

import crypto from 'node:crypto';

// Implémentation isolée de la logique de l'Edge Function pour test unitaire Node.js
function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function timingSafeEqual(a, b) {
  if (typeof crypto !== 'undefined' && 'timingSafeEqual' in crypto && typeof crypto.timingSafeEqual === 'function') {
    return crypto.timingSafeEqual(a, b);
  }
  if (a.byteLength !== b.byteLength) return false;
  let mismatch = 0;
  for (let i = 0; i < a.byteLength; i++) {
    mismatch |= a[i] ^ b[i];
  }
  return mismatch === 0;
}

async function verifyWebhookSecret(providedSecret, expectedSecret) {
  if (!providedSecret || !expectedSecret) return false;
  const enc = new TextEncoder();
  const [hashProvided, hashExpected] = await Promise.all([
    crypto.subtle.digest('SHA-256', enc.encode(providedSecret)),
    crypto.subtle.digest('SHA-256', enc.encode(expectedSecret)),
  ]);
  return timingSafeEqual(new Uint8Array(hashProvided), new Uint8Array(hashExpected));
}

function sanitizeTel(phone) {
  if (!phone) return '';
  return phone.replace(/[^0-9+]/g, '');
}

// MOCK SUPABASE CLIENT EN MÉMOIRE
class MockSupabaseClient {
  constructor(initialData = {}) {
    this.orders = new Map(initialData.orders || []);
    this.profiles = new Map(initialData.profiles || []);
    this.push_subscriptions = new Map(initialData.push_subscriptions || []);
    this.email_logs = [];
  }

  from(table) {
    const self = this;
    return {
      select(cols, opts = {}) {
        return {
          eq(col, val) {
            return {
              is(col2, val2) {
                return {
                  select(cols3) {
                    return this;
                  },
                  async maybeSingle() {
                    return { data: null, error: null };
                  }
                };
              },
              async in(col2, values) {
                if (table === 'push_subscriptions' && col2 === 'user_id') {
                  const matching = Array.from(self.push_subscriptions.values()).filter((s) => values.includes(s.user_id));
                  return { data: matching, error: null };
                }
                return { data: [], error: null };
              },
              async single() {
                return { data: null, error: null };
              },
              async then(resolve) {
                if (table === 'profiles' && col === 'role') {
                  const matching = Array.from(self.profiles.values()).filter((p) => p.role === val);
                  return resolve({ data: matching, error: null });
                }
                if (table === 'orders' && col === 'status' && opts.count === 'exact') {
                  const count = Array.from(self.orders.values()).filter((o) => o.status === val).length;
                  return resolve({ count, data: null, error: null });
                }
                return resolve({ data: [], error: null });
              }
            };
          },
          async in(col, values) {
            if (table === 'push_subscriptions') {
              const matching = Array.from(self.push_subscriptions.values()).filter((s) => values.includes(s.user_id));
              return { data: matching, error: null };
            }
            return { data: [], error: null };
          }
        };
      },
      update(updates) {
        return {
          eq(col, val) {
            return {
              is(col2, val2) {
                return {
                  async select(returnCols) {
                    if (table === 'orders' && col === 'id') {
                      const order = self.orders.get(val);
                      if (order) {
                        if (val2 === null && order[col2] !== null && order[col2] !== undefined) {
                          // Déjà notifié !
                          return { data: [], error: null };
                        }
                        Object.assign(order, updates);
                        return { data: [order], error: null };
                      }
                      return { data: [], error: null };
                    }
                    return { data: [], error: null };
                  }
                };
              },
              async then(resolve) {
                if (table === 'orders' && col === 'id') {
                  const order = self.orders.get(val);
                  if (order) {
                    Object.assign(order, updates);
                  }
                }
                if (table === 'push_subscriptions' && col === 'id') {
                  const sub = self.push_subscriptions.get(val);
                  if (sub) Object.assign(sub, updates);
                }
                return resolve({ data: null, error: null });
              }
            };
          }
        };
      },
      delete() {
        return {
          eq(col, val) {
            return {
              async then(resolve) {
                if (table === 'push_subscriptions' && col === 'id') {
                  self.push_subscriptions.delete(val);
                }
                return resolve({ data: null, error: null });
              }
            };
          }
        };
      },
      insert(rows) {
        return {
          async then(resolve) {
            const arr = Array.isArray(rows) ? rows : [rows];
            if (table === 'email_logs') {
              self.email_logs.push(...arr);
            }
            return resolve({ data: arr, error: null });
          }
        };
      }
    };
  }
}

// DISPATCHER UNIFIÉ IDENTIQUE À L'EDGE FUNCTION
async function runNotifyAdminPaymentTest(request, env, supabase, mockWebPush, mockResendFetch) {
  const providedSecret = request.headers.get('x-webhook-secret');
  const isValidSecret = await verifyWebhookSecret(providedSecret, env.WEBHOOK_SECRET);
  if (!isValidSecret) {
    return { status: 401, body: { error: 'Unauthorized: Invalid x-webhook-secret' } };
  }

  const payload = await request.json();
  const { type, record, old_record } = payload || {};
  const newStatus = record?.status;
  const oldStatus = old_record?.status;

  const isTransitionToSignaled =
    newStatus === 'payment_signaled' &&
    (type === 'INSERT' || !old_record || oldStatus !== 'payment_signaled');

  if (!isTransitionToSignaled) {
    return {
      status: 200,
      body: { skipped: true, reason: 'status_not_transitioned_to_payment_signaled' }
    };
  }

  const orderId = record?.id;
  if (!orderId) {
    return { status: 400, body: { error: 'Missing record.id' } };
  }

  // Réservation atomique
  const { data: updatedOrders } = await supabase
    .from('orders')
    .update({ admin_notified_at: new Date().toISOString() })
    .eq('id', orderId)
    .is('admin_notified_at', null)
    .select('*');

  const order = updatedOrders && updatedOrders[0];
  if (!order) {
    return {
      status: 200,
      body: { skipped: true, reason: 'already_notified_or_not_found', orderId }
    };
  }

  // Décompte des commandes en attente
  const { count: pendingCount } = await supabase
    .from('orders')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'payment_signaled');

  const pendingLabel = pendingCount && pendingCount > 1 ? `${pendingCount} en attente` : '1 en attente';

  // Push
  const sendPush = async () => {
    const { data: adminProfiles } = await supabase.from('profiles').select('id').eq('role', 'admin');
    const adminIds = (adminProfiles || []).map((p) => p.id);
    const { data: subscriptions } = await supabase.from('push_subscriptions').select('*').in('user_id', adminIds);

    let successCount = 0;
    let failedCount = 0;

    for (const sub of (subscriptions || [])) {
      try {
        await mockWebPush.sendNotification(sub, JSON.stringify({
          title: '💰 Paiement à valider',
          body: `${order.customer_name} (${pendingLabel})`
        }));
        successCount++;
      } catch (err) {
        failedCount++;
        if (err.statusCode === 404 || err.statusCode === 410) {
          await supabase.from('push_subscriptions').delete().eq('id', sub.id);
        }
      }
    }
    return { successCount, failedCount };
  };

  // E-mail Resend
  const sendEmail = async () => {
    try {
      const res = await mockResendFetch('https://api.resend.com/emails', {
        headers: { Authorization: `Bearer ${env.RESEND_API_KEY}` },
        body: JSON.stringify({
          to: env.ADMIN_NOTIFY_EMAIL,
          phone: sanitizeTel(order.customer_phone),
          html: escapeHtml(order.customer_name)
        })
      });
      if (res.ok) {
        await supabase.from('email_logs').insert({ order_id: order.id, status: 'sent' });
        return { success: true };
      }
      throw new Error(`HTTP ${res.status}`);
    } catch (e) {
      await supabase.from('email_logs').insert({ order_id: order.id, status: 'failed', error_message: e.message });
      return { success: false, error: e.message };
    }
  };

  const [pushRes, emailRes] = await Promise.allSettled([sendPush(), sendEmail()]);
  const pushVal = pushRes.status === 'fulfilled' ? pushRes.value : { successCount: 0, failedCount: 0 };
  const emailVal = emailRes.status === 'fulfilled' ? emailRes.value : { success: false, error: 'Failed' };

  if (pushVal.successCount === 0 && !emailVal.success) {
    // Rollback atomique
    await supabase.from('orders').update({ admin_notified_at: null }).eq('id', order.id);
    return {
      status: 500,
      body: { error: 'Échec de tous les canaux de notification', rolledBack: true, push: pushVal, email: emailVal }
    };
  }

  return {
    status: 200,
    body: { success: true, orderId: order.id, push: pushVal, email: emailVal }
  };
}

// SUITE DE TESTS
async function runAllTests() {
  console.log('--- DÉBUT DE LA SUITE DE TESTS : notify-admin-payment ---\n');
  const env = {
    WEBHOOK_SECRET: 'test_super_secret_webhook_12345',
    RESEND_API_KEY: 're_test_key_abc',
    ADMIN_NOTIFY_EMAIL: 'admin@thiesdn.site'
  };

  let passedTests = 0;
  let totalTests = 0;

  function assert(condition, testName, details = '') {
    totalTests++;
    if (condition) {
      console.log(`[PASS] ${testName} ${details}`);
      passedTests++;
    } else {
      console.error(`[FAIL] ${testName} ${details}`);
      process.exitCode = 1;
    }
  }

  // TEST 1 : Appel sans secret -> 401
  {
    const req = {
      headers: new Map(),
      json: async () => ({})
    };
    req.headers.get = (k) => req.headers[k.toLowerCase()] || null;
    const res = await runNotifyAdminPaymentTest(req, env, new MockSupabaseClient());
    assert(res.status === 401, 'Test 1 : Appel sans secret x-webhook-secret renvoie 401');
  }

  // TEST 2 : Appel avec secret invalide -> 401
  {
    const req = {
      headers: { 'x-webhook-secret': 'mauvais_secret_invalide' },
      json: async () => ({})
    };
    req.headers.get = (k) => req.headers[k.toLowerCase()] || null;
    const res = await runNotifyAdminPaymentTest(req, env, new MockSupabaseClient());
    assert(res.status === 401, 'Test 2 : Appel avec secret erroné renvoie 401');
  }

  // TEST 3 : Secret valide mais commande inexistante -> 200 skipped
  {
    const req = {
      headers: { 'x-webhook-secret': env.WEBHOOK_SECRET },
      json: async () => ({
        type: 'UPDATE',
        record: { id: 'cmd_inexistante', status: 'payment_signaled' },
        old_record: { id: 'cmd_inexistante', status: 'pending' }
      })
    };
    req.headers.get = (k) => req.headers[k.toLowerCase()] || null;
    const db = new MockSupabaseClient();
    const res = await runNotifyAdminPaymentTest(req, env, db);
    assert(
      res.status === 200 && res.body.skipped === true && res.body.reason === 'already_notified_or_not_found',
      'Test 3 : Commande inexistante répond 200 { skipped: true } sans rien envoyer'
    );
  }

  // TEST 4 : Transition valide UPDATE (pending -> payment_signaled) -> 1 push + 1 e-mail
  {
    const db = new MockSupabaseClient({
      orders: [
        ['cmd_001', { id: 'cmd_001', reference: 'TH-001', status: 'pending', customer_name: 'Amadou Diallo', customer_phone: '+221 77 123 45 67', total_amount: 5000, admin_notified_at: null }]
      ],
      profiles: [
        ['admin_1', { id: 'admin_1', role: 'admin' }]
      ],
      push_subscriptions: [
        ['sub_1', { id: 'sub_1', user_id: 'admin_1', endpoint: 'https://push.example.com/1' }]
      ]
    });

    let pushesSent = 0;
    const mockWebPush = {
      sendNotification: async () => { pushesSent++; return { statusCode: 201 }; }
    };
    let emailsSent = 0;
    const mockResend = async () => { emailsSent++; return { ok: true, status: 200 }; };

    const req = {
      headers: { 'x-webhook-secret': env.WEBHOOK_SECRET },
      json: async () => ({
        type: 'UPDATE',
        record: { id: 'cmd_001', status: 'payment_signaled' },
        old_record: { id: 'cmd_001', status: 'pending' }
      })
    };
    req.headers.get = (k) => req.headers[k.toLowerCase()] || null;

    const res = await runNotifyAdminPaymentTest(req, env, db, mockWebPush, mockResend);
    const orderInDb = db.orders.get('cmd_001');

    assert(
      res.status === 200 &&
      res.body.success === true &&
      pushesSent === 1 &&
      emailsSent === 1 &&
      orderInDb.admin_notified_at !== null &&
      db.email_logs.length === 1 &&
      db.email_logs[0].status === 'sent',
      'Test 4 : Transition UPDATE valide -> 1 push envoyé, 1 e-mail Resend envoyé, admin_notified_at renseigné'
    );

    // TEST 5 : 2e appel identique immédiat sur la même commande -> skipped par idempotence
    const res2 = await runNotifyAdminPaymentTest(req, env, db, mockWebPush, mockResend);
    assert(
      res2.status === 200 &&
      res2.body.skipped === true &&
      res2.body.reason === 'already_notified_or_not_found' &&
      pushesSent === 1 && // aucun nouveau push
      emailsSent === 1,   // aucun nouvel email
      'Test 5 : 2e appel identique sur la même commande -> 200 skipped (idempotence stricte)'
    );
  }

  // TEST 6 : Transition INSERT directement en payment_signaled -> 1 push + 1 e-mail
  {
    const db = new MockSupabaseClient({
      orders: [
        ['cmd_002', { id: 'cmd_002', reference: 'TH-002', status: 'payment_signaled', customer_name: 'Fatou Ndiaye', customer_phone: '781112233', total_amount: 3000, admin_notified_at: null }]
      ],
      profiles: [
        ['admin_1', { id: 'admin_1', role: 'admin' }]
      ],
      push_subscriptions: [
        ['sub_2', { id: 'sub_2', user_id: 'admin_1', endpoint: 'https://push.example.com/2' }]
      ]
    });

    let pushesSent = 0;
    const mockWebPush = {
      sendNotification: async () => { pushesSent++; return { statusCode: 201 }; }
    };
    let emailsSent = 0;
    const mockResend = async () => { emailsSent++; return { ok: true, status: 200 }; };

    const req = {
      headers: { 'x-webhook-secret': env.WEBHOOK_SECRET },
      json: async () => ({
        type: 'INSERT',
        record: { id: 'cmd_002', status: 'payment_signaled' },
        old_record: null
      })
    };
    req.headers.get = (k) => req.headers[k.toLowerCase()] || null;

    const res = await runNotifyAdminPaymentTest(req, env, db, mockWebPush, mockResend);
    assert(
      res.status === 200 && res.body.success === true && pushesSent === 1 && emailsSent === 1,
      'Test 6 : INSERT direct avec status=payment_signaled -> alerte push et e-mail déclenchées'
    );
  }

  // TEST 7 : Subscription retournant 410 (Gone) -> supprimée de push_subscriptions
  {
    const db = new MockSupabaseClient({
      orders: [
        ['cmd_003', { id: 'cmd_003', reference: 'TH-003', status: 'pending', customer_name: 'Ousmane Sow', total_amount: 10000, admin_notified_at: null }]
      ],
      profiles: [
        ['admin_1', { id: 'admin_1', role: 'admin' }]
      ],
      push_subscriptions: [
        ['sub_expired', { id: 'sub_expired', user_id: 'admin_1', endpoint: 'https://push.example.com/expired' }]
      ]
    });

    const mockWebPush = {
      sendNotification: async () => {
        const err = new Error('Subscription has expired or is unsubscribed');
        err.statusCode = 410;
        throw err;
      }
    };
    const mockResend = async () => ({ ok: true, status: 200 });

    const req = {
      headers: { 'x-webhook-secret': env.WEBHOOK_SECRET },
      json: async () => ({
        type: 'UPDATE',
        record: { id: 'cmd_003', status: 'payment_signaled' },
        old_record: { id: 'cmd_003', status: 'pending' }
      })
    };
    req.headers.get = (k) => req.headers[k.toLowerCase()] || null;

    await runNotifyAdminPaymentTest(req, env, db, mockWebPush, mockResend);
    const subExists = db.push_subscriptions.has('sub_expired');
    assert(
      subExists === false,
      'Test 7 : Subscription retournant HTTP 410 (Gone) -> supprimée automatiquement de push_subscriptions'
    );
  }

  // TEST 8 : Échec des deux canaux (Push échoue + E-mail échoue) -> admin_notified_at remis à NULL (Rollback)
  {
    const db = new MockSupabaseClient({
      orders: [
        ['cmd_004', { id: 'cmd_004', reference: 'TH-004', status: 'pending', customer_name: 'Mariama Ba', total_amount: 8000, admin_notified_at: null }]
      ],
      profiles: [
        ['admin_1', { id: 'admin_1', role: 'admin' }]
      ],
      push_subscriptions: [
        ['sub_broken', { id: 'sub_broken', user_id: 'admin_1', endpoint: 'https://push.example.com/broken' }]
      ]
    });

    const mockWebPush = {
      sendNotification: async () => {
        const err = new Error('Push Service Unavailable 503');
        err.statusCode = 503;
        throw err;
      }
    };
    const mockResend = async () => ({
      ok: false,
      status: 500,
      json: async () => ({ message: 'Resend API down' })
    });

    const req = {
      headers: { 'x-webhook-secret': env.WEBHOOK_SECRET },
      json: async () => ({
        type: 'UPDATE',
        record: { id: 'cmd_004', status: 'payment_signaled' },
        old_record: { id: 'cmd_004', status: 'pending' }
      })
    };
    req.headers.get = (k) => req.headers[k.toLowerCase()] || null;

    const res = await runNotifyAdminPaymentTest(req, env, db, mockWebPush, mockResend);
    const orderInDb = db.orders.get('cmd_004');

    assert(
      res.status === 500 &&
      res.body.rolledBack === true &&
      orderInDb.admin_notified_at === null,
      'Test 8 : Échec complet Push + E-mail -> admin_notified_at remis à NULL pour permettre un réessai ultérieur'
    );
  }

  console.log(`\nRÉSULTATS DU BANC DE TEST : ${passedTests}/${totalTests} tests réussis avec succès.\n`);
}

runAllTests();
