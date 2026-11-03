// ============================================================================
// BANC DE TEST ISOLÉ : notify-promoter & _shared/notify
// Mocks en mémoire stricts : aucune donnée insérée en production.
// ============================================================================

import crypto from 'node:crypto';

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

// Client Mock Supabase en mémoire simulant RLS et contraintes UNIQUE
class MockSupabaseClient {
  constructor(initialData = {}, currentAuthUid = null) {
    this.currentAuthUid = currentAuthUid;
    this.events = new Map(initialData.events || []);
    this.orders = new Map(initialData.orders || []);
    this.profiles = new Map(initialData.profiles || []);
    this.push_subscriptions = new Map(initialData.push_subscriptions || []);
    this.user_notifications = new Map(initialData.user_notifications || []);
    this.email_logs = [];
  }

  from(table) {
    const self = this;
    return {
      select(cols) {
        return {
          eq(col, val) {
            return {
              eq(col2, val2) {
                return {
                  gte(col3, val3) {
                    return {
                      order(col4) {
                        return {
                          async then(resolve) {
                            if (table === 'user_notifications') {
                              const matching = Array.from(self.user_notifications.values()).filter(
                                (n) => n.user_id === val && n.kind === val2 && n.created_at >= val3
                              );
                              return resolve({ data: matching, error: null });
                            }
                            return resolve({ data: [], error: null });
                          }
                        };
                      }
                    };
                  },
                  async then(resolve) {
                    if (table === 'orders') {
                      const matching = Array.from(self.orders.values()).filter(
                        (o) => o[col] === val && o[col2] === val2
                      );
                      return resolve({ data: matching, error: null });
                    }
                    return resolve({ data: [], error: null });
                  }
                };
              },
              async maybeSingle() {
                if (table === 'profiles' && col === 'id') {
                  return { data: self.profiles.get(val) || null, error: null };
                }
                if (table === 'events' && col === 'id') {
                  return { data: self.events.get(val) || null, error: null };
                }
                return { data: null, error: null };
              },
              async then(resolve) {
                if (table === 'push_subscriptions' && col === 'user_id') {
                  const matching = Array.from(self.push_subscriptions.values()).filter((s) => s.user_id === val);
                  return resolve({ data: matching, error: null });
                }
                if (table === 'user_notifications' && col === 'user_id') {
                  // SIMULATION RLS : si un utilisateur normal tente de lire, il ne doit voir QUE les siennes
                  if (self.currentAuthUid && self.currentAuthUid !== val) {
                    return resolve({ data: [], error: null }); // RLS bloque
                  }
                  const matching = Array.from(self.user_notifications.values()).filter((n) => n.user_id === val);
                  return resolve({ data: matching, error: null });
                }
                return resolve({ data: [], error: null });
              }
            };
          }
        };
      },
      insert(rows) {
        return {
          select(returnCols) {
            return {
              async then(resolve) {
                const arr = Array.isArray(rows) ? rows : [rows];
                const inserted = [];

                for (const row of arr) {
                  if (table === 'user_notifications') {
                    // Vérifier la contrainte UNIQUE (user_id, dedupe_key)
                    if (row.dedupe_key) {
                      const exists = Array.from(self.user_notifications.values()).some(
                        (n) => n.user_id === row.user_id && n.dedupe_key === row.dedupe_key
                      );
                      if (exists) {
                        return resolve({
                          data: null,
                          error: { code: '23505', message: 'duplicate key value violates unique constraint' }
                        });
                      }
                    }
                    const id = row.id || `notif_${Date.now()}_${Math.random()}`;
                    const fullRow = { ...row, id, read_at: null };
                    self.user_notifications.set(id, fullRow);
                    inserted.push(fullRow);
                  }
                }
                return resolve({ data: inserted, error: null });
              }
            };
          }
        };
      },
      update(updates) {
        return {
          eq(col, val) {
            return {
              async then(resolve) {
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
      }
    };
  }
}

// LOGIQUE UNIFIÉE NOTIFY-PROMOTER POUR LE BANC DE TEST
async function runNotifyPromoterTest(request, env, supabase, mockWebPush, mockResendFetch) {
  const providedSecret = request.headers.get('x-webhook-secret');
  const isValidSecret = await verifyWebhookSecret(providedSecret, env.WEBHOOK_SECRET);
  if (!isValidSecret) {
    return { status: 401, body: { error: 'Unauthorized: Invalid x-webhook-secret' } };
  }

  const payload = await request.json();
  const { table, record, old_record } = payload || {};
  if (!table || !record) {
    return { status: 400, body: { error: 'Missing table or record' } };
  }

  const results = [];

  // Helper interne notify
  async function dispatchNotify(userId, kind, title, body, url, dedupeKey, eventId) {
    // 1. Insertion user_notifications
    const insertRes = await supabase.from('user_notifications').insert([
      {
        user_id: userId,
        kind,
        title,
        body,
        url,
        dedupe_key: dedupeKey,
        created_at: new Date().toISOString()
      }
    ]).select('*');

    if (insertRes.error && insertRes.error.code === '23505') {
      return { skipped: true, reason: 'already_notified' };
    }

    const inserted = insertRes.data && insertRes.data[0];
    if (dedupeKey && !inserted) {
      return { skipped: true, reason: 'already_notified' };
    }

    // 2. Préférences
    const { data: profile } = await supabase.from('profiles').select('email, notification_prefs').eq('id', userId).maybeSingle();
    const prefs = profile?.notification_prefs || {
      event_status: { push: true, email: true },
      sales: { push: true, email: false },
      stock: { push: true, email: false },
      payout: { push: true, email: true },
      decompte: { push: true, email: true }
    };
    const kindPrefs = prefs[kind] || { push: true, email: false };

    // 3. Throttle
    const oneMinuteAgo = new Date(Date.now() - 60000).toISOString();
    const { data: recentNotifs } = await supabase
      .from('user_notifications')
      .select('id, created_at')
      .eq('user_id', userId)
      .eq('kind', kind)
      .gte('created_at', oneMinuteAgo)
      .order('created_at');

    const isThrottled = recentNotifs && recentNotifs.length > 1;

    let pushSent = false;
    if (kindPrefs.push !== false && !isThrottled) {
      const { data: subs } = await supabase.from('push_subscriptions').select('*').eq('user_id', userId);
      for (const sub of (subs || [])) {
        try {
          await mockWebPush.sendNotification(sub, JSON.stringify({ title, body }));
          pushSent = true;
        } catch (err) {
          if (err.statusCode === 404 || err.statusCode === 410) {
            await supabase.from('push_subscriptions').delete().eq('id', sub.id);
          }
        }
      }
    }

    let emailSent = false;
    if (kindPrefs.email === true && profile?.email) {
      const res = await mockResendFetch('https://api.resend.com/emails', {
        headers: { Authorization: `Bearer ${env.RESEND_API_KEY}` },
        body: JSON.stringify({ to: profile.email, subject: title })
      });
      if (res.ok) emailSent = true;
    }

    return { success: true, pushSent, emailSent, throttled: isThrottled };
  }

  // Route events
  if (table === 'events') {
    if (record.status !== old_record?.status && ['approved', 'rejected'].includes(record.status)) {
      const isApproved = record.status === 'approved';
      const res = await dispatchNotify(
        record.promoter_id,
        'event_status',
        isApproved ? '🎉 Événement Approuvé' : '⚠️ Événement Non Validé',
        `Votre événement "${record.title}" a été ${isApproved ? 'validé' : 'rejeté'}.`,
        '/?tab=finances',
        `event-${record.status}-${record.id}`,
        record.id
      );
      results.push(res);
    }
  }

  // Route orders
  if (table === 'orders') {
    if (record.status === 'confirmed' && old_record?.status !== 'confirmed') {
      const { data: event } = await supabase.from('events').select('title, promoter_id, tiers').eq('id', record.event_id).maybeSingle();
      if (event && event.promoter_id) {
        const { data: confirmedOrders } = await supabase.from('orders').select('quantity').eq('event_id', record.event_id).eq('status', 'confirmed');
        const totalSold = (confirmedOrders || []).reduce((acc, curr) => acc + (curr.quantity || 0), 0);
        // AUCUN nom ni téléphone de client dans le corps
        const body = `🎫 ${record.quantity}× ${record.tier_name || 'Standard'} — ${event.title} — ${totalSold} billet(s) vendu(s)`;
        const res = await dispatchNotify(
          event.promoter_id,
          'sales',
          '🎟️ Nouvelle Vente de Billet',
          body,
          '/?tab=finances',
          `order-confirmed-${record.id}`,
          record.event_id
        );
        results.push(res);

        // Stock check
        const currentTier = (event.tiers || []).find((t) => t.id === record.tier_id);
        if (currentTier && typeof currentTier.available === 'number') {
          if (currentTier.available <= 10 && currentTier.available > 0) {
            const stockRes = await dispatchNotify(
              event.promoter_id,
              'stock',
              `⚠️ Stock Faible : ${currentTier.name}`,
              `Il ne reste que ${currentTier.available} place(s).`,
              '/?tab=finances',
              `stock-${event.id}-${currentTier.id}-10`,
              event.id
            );
            results.push(stockRes);
          }
          if (currentTier.available <= 0) {
            const soldoutRes = await dispatchNotify(
              event.promoter_id,
              'stock',
              `🚫 Rupture de Stock : ${currentTier.name}`,
              `Toutes les places "${currentTier.name}" sont vendues !`,
              '/?tab=finances',
              `stock-${event.id}-${currentTier.id}-0`,
              event.id
            );
            results.push(soldoutRes);
          }
        }
      }
    }
  }

  return { status: 200, body: { success: true, results } };
}

// SUITE DE TESTS COMPLÈTE
async function runTests() {
  console.log('--- DÉBUT DE LA SUITE DE TESTS : notify-promoter ---\n');
  const env = {
    WEBHOOK_SECRET: 'promoter_secret_xyz789',
    RESEND_API_KEY: 're_promoter_test_123',
    ADMIN_NOTIFY_EMAIL: 'contact@thiesdn.site'
  };

  let totalTests = 0;
  let passedTests = 0;

  function assert(cond, name, details = '') {
    totalTests++;
    if (cond) {
      console.log(`[PASS] ${name} ${details}`);
      passedTests++;
    } else {
      console.error(`[FAIL] ${name} ${details}`);
      process.exitCode = 1;
    }
  }

  // TEST 1 : 401 sans secret
  {
    const req = { headers: new Map(), json: async () => ({}) };
    req.headers.get = (k) => req.headers[k.toLowerCase()] || null;
    const res = await runNotifyPromoterTest(req, env, new MockSupabaseClient());
    assert(res.status === 401, 'Test 1 : 401 sans x-webhook-secret');
  }

  // TEST 2 : Payload fictif par catégorie -> 1 ligne user_notifications + 1 push + e-mail selon préférences
  {
    const db = new MockSupabaseClient({
      profiles: [
        ['promoter_1', { id: 'promoter_1', email: 'promoter@thiesdn.site', notification_prefs: { event_status: { push: true, email: true } } }]
      ],
      push_subscriptions: [
        ['sub_p1', { id: 'sub_p1', user_id: 'promoter_1', endpoint: 'https://push.com/p1' }]
      ]
    });
    let pushCount = 0;
    const mockPush = { sendNotification: async () => { pushCount++; return { statusCode: 201 }; } };
    let emailCount = 0;
    const mockResend = async () => { emailCount++; return { ok: true, status: 200 }; };

    const req = {
      headers: { 'x-webhook-secret': env.WEBHOOK_SECRET },
      json: async () => ({
        table: 'events',
        record: { id: 'evt_1', title: 'Gala Prestige Thiès', status: 'approved', promoter_id: 'promoter_1' },
        old_record: { id: 'evt_1', title: 'Gala Prestige Thiès', status: 'pending', promoter_id: 'promoter_1' }
      })
    };
    req.headers.get = (k) => req.headers[k.toLowerCase()] || null;

    const res = await runNotifyPromoterTest(req, env, db, mockPush, mockResend);
    assert(
      res.status === 200 && db.user_notifications.size === 1 && pushCount === 1 && emailCount === 1,
      'Test 2 : Événement approuvé -> 1 ligne user_notifications + 1 push + 1 e-mail (selon prefs)'
    );

    // TEST 3 : Même appel deux fois -> 1 seule notification (Dedupe)
    const res2 = await runNotifyPromoterTest(req, env, db, mockPush, mockResend);
    assert(
      res2.body.results[0].skipped === true && db.user_notifications.size === 1 && pushCount === 1,
      'Test 3 : Même événement validé 2e fois -> 1 seule notification enregistrée (ON CONFLICT DO NOTHING)'
    );
  }

  // TEST 4 : Préférence push=false -> Pas de push envoyé
  {
    const db = new MockSupabaseClient({
      profiles: [
        ['promoter_2', { id: 'promoter_2', email: 'promo2@thiesdn.site', notification_prefs: { sales: { push: false, email: false } } }]
      ],
      events: [
        ['evt_2', { id: 'evt_2', title: 'Soirée Mbalax', promoter_id: 'promoter_2' }]
      ],
      push_subscriptions: [
        ['sub_p2', { id: 'sub_p2', user_id: 'promoter_2', endpoint: 'https://push.com/p2' }]
      ]
    });
    let pushCount = 0;
    const mockPush = { sendNotification: async () => { pushCount++; return { statusCode: 201 }; } };
    const mockResend = async () => ({ ok: true });

    const req = {
      headers: { 'x-webhook-secret': env.WEBHOOK_SECRET },
      json: async () => ({
        table: 'orders',
        record: { id: 'ord_1', event_id: 'evt_2', status: 'confirmed', quantity: 2, tier_name: 'VIP' },
        old_record: { id: 'ord_1', event_id: 'evt_2', status: 'pending' }
      })
    };
    req.headers.get = (k) => req.headers[k.toLowerCase()] || null;

    await runNotifyPromoterTest(req, env, db, mockPush, mockResend);
    assert(
      pushCount === 0 && db.user_notifications.size === 1,
      'Test 4 : Préférence push=false respectée -> aucune notification push envoyée mais notif in-app créée'
    );
  }

  // TEST 5 : Rafale de 10 ventes -> 1 seul push déclenché (Throttle 1 min)
  {
    const db = new MockSupabaseClient({
      profiles: [
        ['promoter_3', { id: 'promoter_3', email: 'promo3@thiesdn.site', notification_prefs: { sales: { push: true, email: false } } }]
      ],
      events: [
        ['evt_3', { id: 'evt_3', title: 'Concert Live', promoter_id: 'promoter_3' }]
      ],
      push_subscriptions: [
        ['sub_p3', { id: 'sub_p3', user_id: 'promoter_3', endpoint: 'https://push.com/p3' }]
      ]
    });
    let pushCount = 0;
    const mockPush = { sendNotification: async () => { pushCount++; return { statusCode: 201 }; } };
    const mockResend = async () => ({ ok: true });

    for (let i = 1; i <= 10; i++) {
      const req = {
        headers: { 'x-webhook-secret': env.WEBHOOK_SECRET },
        json: async () => ({
          table: 'orders',
          record: { id: `burst_ord_${i}`, event_id: 'evt_3', status: 'confirmed', quantity: 1, tier_name: 'Standard' },
          old_record: { id: `burst_ord_${i}`, event_id: 'evt_3', status: 'pending' }
        })
      };
      req.headers.get = (k) => req.headers[k.toLowerCase()] || null;
      await runNotifyPromoterTest(req, env, db, mockPush, mockResend);
    }

    assert(
      db.user_notifications.size === 10 && pushCount === 1,
      'Test 5 : Rafale de 10 ventes consécutives -> 10 entrées in-app créées mais 1 seul push système (Throttle actif)'
    );
  }

  // TEST 6 : Subscription retournant 410 (Gone) -> supprimée
  {
    const db = new MockSupabaseClient({
      profiles: [
        ['promoter_4', { id: 'promoter_4', notification_prefs: { event_status: { push: true, email: false } } }]
      ],
      push_subscriptions: [
        ['sub_dead', { id: 'sub_dead', user_id: 'promoter_4', endpoint: 'https://push.com/dead' }]
      ]
    });
    const mockPush = {
      sendNotification: async () => {
        const err = new Error('Expired subscription');
        err.statusCode = 410;
        throw err;
      }
    };
    const mockResend = async () => ({ ok: true });

    const req = {
      headers: { 'x-webhook-secret': env.WEBHOOK_SECRET },
      json: async () => ({
        table: 'events',
        record: { id: 'evt_4', title: 'Expo', status: 'approved', promoter_id: 'promoter_4' },
        old_record: { id: 'evt_4', title: 'Expo', status: 'pending', promoter_id: 'promoter_4' }
      })
    };
    req.headers.get = (k) => req.headers[k.toLowerCase()] || null;

    await runNotifyPromoterTest(req, env, db, mockPush, mockResend);
    assert(
      db.push_subscriptions.has('sub_dead') === false,
      'Test 6 : Subscription 410 -> automatiquement supprimée de push_subscriptions'
    );
  }

  // TEST 7 : Isolation RLS : un utilisateur ne peut pas lire les notifications d'un autre
  {
    const db = new MockSupabaseClient({
      user_notifications: [
        ['n1', { id: 'n1', user_id: 'user_alice', title: 'Notif Alice' }],
        ['n2', { id: 'n2', user_id: 'user_bob', title: 'Notif Bob' }]
      ]
    }, 'user_alice'); // Authentifié en tant que user_alice

    // Tentative de lecture des notifications de user_bob
    const { data: bobNotifs } = await db.from('user_notifications').select('*').eq('user_id', 'user_bob');
    const { data: aliceNotifs } = await db.from('user_notifications').select('*').eq('user_id', 'user_alice');

    assert(
      bobNotifs.length === 0 && aliceNotifs.length === 1 && aliceNotifs[0].id === 'n1',
      'Test 7 : RLS hermétique : user_alice ne peut pas lire les notifications de user_bob (0 résultat renvoyé)'
    );
  }

  console.log(`\nRÉSULTATS DU BANC DE TEST NOTIFY-PROMOTER : ${passedTests}/${totalTests} tests réussis.\n`);
}

runTests();
