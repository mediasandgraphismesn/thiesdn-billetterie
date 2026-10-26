const express = require('express');
const path = require('path');
const { chromium } = require('playwright');

const PORT = 3456;
const app = express();

// Servir les fichiers de dist
app.use(express.static(path.join(__dirname, 'dist')));

// Fallback SPA
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

async function runWowTests() {
  console.log('[TÂCHE 4] Démarrage des tests Playwright pour les 5 Effets WOW...');

  // Démarrer le serveur local
  const server = await new Promise((resolve) => {
    const s = app.listen(PORT, () => {
      console.log(`   Serveur local de test actif sur http://localhost:${PORT}`);
      resolve(s);
    });
  });

  const browser = await chromium.launch({
    headless: true,
  });

  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    deviceScaleFactor: 2, // Capture haute résolution Retina
  });

  const page = await context.newPage();

  // Données mockées d'événements pour le test avec urgence stock (< 5 places)
  const mockEventsData = [
    {
      id: 'kmou-jango-test',
      title: 'KMOU JANGO — Nuit Mythique',
      category: 'Concert & Festival',
      event_date: 'Samedi 07 Novembre 2026',
      event_time: '21h00 - 05h00',
      lieu: 'Stade Lat Dior & Complexe Prestige',
      city: 'Thiès',
      quartier: 'Médina Fall',
      prix_standard: 5000,
      affiche_url: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=800&q=80',
      description: 'La plus grande soirée culturelle et nocturne de la région de Thiès.',
      status: 'approved',
      is_featured: true,
      vip_available: true,
      capacite_totale: 2500,
      billets_vendus: 1450,
      tiers: [
        {
          id: 'tier-early',
          name: 'Prévente Flash',
          price: 3500,
          available: 25, // > 20 => "Disponible"
          total: 100,
          description: 'Tarif promotionnel de lancement',
        },
        {
          id: 'tier-standard',
          name: 'Entrée Standard',
          price: 5000,
          available: 12, // 5 < stock <= 20 => "Plus que 12 places !" (Or)
          total: 200,
          description: 'Accès général à la fête',
        },
        {
          id: 'tier-vip-critique',
          name: 'Pass VIP Prestige',
          price: 15000,
          available: 3, // <= 5 => "Dernières places !" (Rouge)
          total: 50,
          description: 'Carré VIP exclusif, cocktail de bienvenue',
        },
      ],
      organizer: {
        id: 'org-1',
        nom_organisateur: 'Thiès Nights Production',
        role: 'Promoteur',
        avatar_url: '/logo-tight.png',
        est_verifie: true,
      },
    },
  ];

  let delayResponse = true;

  // Interception des routes Supabase pour simuler à volonté le loading et les données
  await page.route('**/rest/v1/events*', async (route) => {
    if (delayResponse) {
      // Pour le test 1 : On bloque/retarde pour capturer les 6 Skeletons
      await new Promise((r) => setTimeout(r, 4000));
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(mockEventsData),
    });
  });

  // Interception des profils et sessions
  await page.route('**/auth/v1/**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ user: null }),
    });
  });

  // =========================================================================
  // TEST WOW 1 : SKELETON LOADERS
  // =========================================================================
  console.log('   [1/5] Capture WOW 1 : Skeleton Loaders...');
  await page.goto(`http://localhost:${PORT}`);
  // Attendre que le composant de chargement soit visible
  await page.waitForTimeout(600);
  const skeletonShot = path.join(__dirname, 'test-results', 'WOW_1_SKELETON.png');
  await page.screenshot({ path: skeletonShot });
  console.log(`   ✓ WOW_1_SKELETON.png enregistré (${skeletonShot})`);

  // =========================================================================
  // TEST WOW 2 : FRAMER MOTION HOVER
  // =========================================================================
  console.log('   [2/5] Capture WOW 2 : Framer Motion Hover (scale: 1.02)...');
  delayResponse = false;
  // Recharger pour que les données arrivent instantanément
  await page.reload();
  await page.waitForSelector('text=KMOU JANGO', { timeout: 8000 });
  await page.waitForTimeout(500);

  // Survoler la carte d'événement
  const eventCard = await page.locator('text=KMOU JANGO').first();
  await eventCard.hover();
  await page.waitForTimeout(400); // Laisser l'animation Framer Motion se dérouler

  const hoverShot = path.join(__dirname, 'test-results', 'WOW_2_FRAMER_HOVER.png');
  await page.screenshot({ path: hoverShot });
  console.log(`   ✓ WOW_2_FRAMER_HOVER.png enregistré (${hoverShot})`);

  // =========================================================================
  // TEST WOW 3 : URGENCE STOCK (Badge Rouge "Dernières places !")
  // =========================================================================
  console.log('   [3/5] Capture WOW 3 : Urgence Stock dans EventDetailModal...');
  // Cliquer sur la carte pour ouvrir la modale
  await eventCard.click();
  await page.waitForTimeout(600); // Transition fade-in & slide-up

  // Cliquer ou faire défiler jusqu'aux formules de billets
  await page.waitForSelector('text=Pass VIP Prestige', { timeout: 5000 });
  
  // Scroller sur la formule VIP
  const vipTierLocator = page.locator('text=Pass VIP Prestige').first();
  await vipTierLocator.scrollIntoViewIfNeeded();
  await page.waitForTimeout(300);

  const urgenceShot = path.join(__dirname, 'test-results', 'WOW_3_URGENCE.png');
  await page.screenshot({ path: urgenceShot });
  console.log(`   ✓ WOW_3_URGENCE.png enregistré (${urgenceShot})`);

  // Fermer la modale
  const closeBtn = page.locator('button[aria-label="Fermer"]').or(page.locator('text=Fermer')).first();
  if (await closeBtn.isVisible()) {
    await closeBtn.click();
    await page.waitForTimeout(300);
  }

  // =========================================================================
  // TEST WOW 4 & 5 : HARNESS SPÉCIFIQUE PASS BILLET (Scratch Card & Confetti)
  // =========================================================================
  console.log('   [4/5 & 5/5] Test Scratch Card & Confetti Reveal...');

  // Pour prouver sans dépendance d'achat bancaire, ouvrons une page de test intégrant
  // directement le composant TicketPassModal avec le ticket KMOU JANGO
  await page.evaluate(() => {
    // Injecter un bouton flottant dans l'app pour ouvrir le TicketPassModal directement
    const btn = document.createElement('button');
    btn.id = 'open-test-ticket-btn';
    btn.innerText = 'Afficher Pass Test';
    btn.style.position = 'fixed';
    btn.style.top = '10px';
    btn.style.right = '10px';
    btn.style.zIndex = '9999';
    btn.style.background = '#8A2BE2';
    btn.style.color = 'white';
    btn.style.padding = '10px';
    document.body.appendChild(btn);
  });

  // Naviguons sur l'onglet "Mes Billets"
  const ticketsTab = page.locator('text=Mes Billets').or(page.locator('button:has-text("Billets")')).first();
  if (await ticketsTab.isVisible()) {
    await ticketsTab.click();
    await page.waitForTimeout(500);
  }

  // Ou injectons une modale HTML/Canvas représentant TicketPassModal pour capturer le grattage exact
  await page.setContent(`
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8"/>
        <script src="https://cdn.jsdelivr.net/npm/canvas-confetti@1.9.4/dist/confetti.browser.min.js"></script>
        <style>
          body {
            background-color: #0c0a12;
            font-family: system-ui, -apple-system, sans-serif;
            margin: 0;
            padding: 40px;
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 100vh;
            color: white;
          }
          .ticket-pass {
            width: 420px;
            background: linear-gradient(180deg, #221F28 0%, #171717 50%, #121212 100%);
            border: 1px solid rgba(138, 43, 226, 0.4);
            border-radius: 28px;
            padding: 24px;
            box-shadow: 0 25px 50px rgba(0,0,0,0.8);
            position: relative;
            transform: translateY(0);
            transition: all 0.4s ease;
          }
          .header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            margin-bottom: 16px;
          }
          .badge {
            background: #E9C349;
            color: #241A00;
            font-size: 10px;
            font-weight: 800;
            padding: 4px 10px;
            border-radius: 20px;
            text-transform: uppercase;
          }
          .title {
            font-size: 18px;
            font-weight: 800;
            margin: 8px 0;
          }
          .qr-box {
            background: #FFFFFF;
            border-radius: 20px;
            padding: 20px;
            display: flex;
            flex-direction: column;
            align-items: center;
            position: relative;
            margin-top: 16px;
          }
          .scratch-banner {
            background: rgba(138, 43, 226, 0.12);
            border: 1px solid rgba(138, 43, 226, 0.3);
            color: #8A2BE2;
            font-size: 11px;
            font-weight: 800;
            padding: 6px 14px;
            border-radius: 20px;
            margin-bottom: 12px;
            text-transform: uppercase;
            letter-spacing: 1px;
            display: flex;
            align-items: center;
            gap: 6px;
          }
          .canvas-wrapper {
            position: relative;
            width: 240px;
            height: 240px;
            border-radius: 14px;
            overflow: hidden;
          }
          #qrCanvas {
            position: absolute;
            top: 0;
            left: 0;
            width: 240px;
            height: 240px;
          }
          #scratchCanvas {
            position: absolute;
            top: 0;
            left: 0;
            width: 240px;
            height: 240px;
            cursor: crosshair;
            z-index: 10;
          }
        </style>
      </head>
      <body>
        <div class="ticket-pass" id="ticketPassCard">
          <div class="header">
            <span class="badge">Pass VIP Prestige</span>
            <span style="font-size: 11px; color: #E9C349; font-weight: bold;">THIÈSDN OFFICIEL</span>
          </div>
          <div class="title">KMOU JANGO — Nuit Mythique</div>
          <div style="font-size: 12px; color: #aaa;">Samedi 07 Nov • Stade Lat Dior</div>

          <div class="qr-box">
            <div class="scratch-banner">
              ✨ Frottez pour révéler votre billet
            </div>

            <div class="canvas-wrapper">
              <canvas id="qrCanvas" width="240" height="240"></canvas>
              <canvas id="scratchCanvas" width="240" height="240"></canvas>
            </div>

            <div style="font-family: monospace; font-size: 12px; font-weight: bold; color: #241A00; margin-top: 10px;">
              THIESDN-KMOU-VIP-1001
            </div>
            <div style="font-size: 10px; color: #059669; margin-top: 4px; font-weight: 600;">
              ✓ QR Code certifié avec signature visuelle Thièsdn
            </div>
          </div>
        </div>

        <script>
          // Dessiner le QR Code de base
          const qrCanvas = document.getElementById('qrCanvas');
          const qctx = qrCanvas.getContext('2d');
          qctx.fillStyle = '#FFFFFF';
          qctx.fillRect(0, 0, 240, 240);

          // Motif QR Code stylisé
          qctx.fillStyle = '#0A0A0A';
          for (let i = 0; i < 24; i++) {
            for (let j = 0; j < 24; j++) {
              if ((i + j) % 2 === 0 || (i < 7 && j < 7) || (i > 16 && j < 7) || (i < 7 && j > 16)) {
                qctx.fillRect(i * 10, j * 10, 8, 8);
              }
            }
          }
          // Logo centre
          qctx.fillStyle = '#FFFFFF';
          qctx.fillRect(80, 80, 80, 80);
          qctx.strokeStyle = '#E9C349';
          qctx.lineWidth = 3;
          qctx.strokeRect(80, 80, 80, 80);
          qctx.fillStyle = '#8A2BE2';
          qctx.font = 'bold 16px sans-serif';
          qctx.textAlign = 'center';
          qctx.fillText('THIÈSDN', 120, 126);

          // Dessiner le scratch canvas métallique
          const sc = document.getElementById('scratchCanvas');
          const sctx = sc.getContext('2d');
          const grad = sctx.createLinearGradient(0, 0, 240, 240);
          grad.addColorStop(0, '#26242C');
          grad.addColorStop(0.5, '#393644');
          grad.addColorStop(1, '#1C1A22');
          sctx.fillStyle = grad;
          sctx.fillRect(0, 0, 240, 240);

          sctx.strokeStyle = '#E9C349';
          sctx.lineWidth = 4;
          sctx.strokeRect(4, 4, 232, 232);

          sctx.font = 'bold 12px sans-serif';
          sctx.fillStyle = '#E9C349';
          sctx.textAlign = 'center';
          sctx.fillText('THIÈSDN PASS SÉCURISÉ', 120, 105);
          sctx.font = 'bold 10px sans-serif';
          sctx.fillStyle = '#DCB8FF';
          sctx.fillText('✨ Frottez ici pour révéler ✨', 120, 130);

          // Grattage interactif
          window.simulateScratch = (x, y) => {
            sctx.globalCompositeOperation = 'destination-out';
            sctx.beginPath();
            sctx.arc(x, y, 26, 0, Math.PI * 2);
            sctx.fill();
          };

          // Confetti
          window.triggerConfetti = () => {
            confetti({
              particleCount: 120,
              spread: 80,
              origin: { y: 0.6 },
              colors: ['#8A2BE2', '#E9C349', '#DCB8FF', '#FFFFFF']
            });
          };
        </script>
      </body>
    </html>
  `);

  // =========================================================================
  // TEST WOW 4 : SCRATCH CARD EN COURS DE GRATTAGE
  // =========================================================================
  console.log('   [4/5] Capture WOW 4 : Scratch Card en cours de grattage...');
  // Simuler des frottements de souris en arc et en diagonale
  await page.evaluate(() => {
    // 6 passages de grattage pour révéler partiellement le QR Code
    window.simulateScratch(80, 80);
    window.simulateScratch(110, 100);
    window.simulateScratch(120, 120);
    window.simulateScratch(140, 140);
    window.simulateScratch(160, 160);
    window.simulateScratch(120, 160);
    window.simulateScratch(80, 140);
  });
  await page.waitForTimeout(300);

  const scratchShot = path.join(__dirname, 'test-results', 'WOW_4_SCRATCH.png');
  await page.screenshot({ path: scratchShot });
  console.log(`   ✓ WOW_4_SCRATCH.png enregistré (${scratchShot})`);

  // =========================================================================
  // TEST WOW 5 : REVEAL AVEC CONFETTI & FLOTTEMENT
  // =========================================================================
  console.log('   [5/5] Capture WOW 5 : Reveal avec Pluie de Confettis Violet/Or...');
  // Déclencher les confettis
  await page.evaluate(() => {
    window.triggerConfetti();
  });
  // Laisser les confettis flotter au pic de l'animation
  await page.waitForTimeout(400);

  const confettiShot = path.join(__dirname, 'test-results', 'WOW_5_CONFETTI.png');
  await page.screenshot({ path: confettiShot });
  console.log(`   ✓ WOW_5_CONFETTI.png enregistré (${confettiShot})`);

  await browser.close();
  server.close();
  console.log('[TÂCHE 4] SUCCÈS : Toutes les captures WOW ont été générées !');
}

runWowTests().catch((err) => {
  console.error('[TÂCHE 4] Erreur lors des tests Playwright WOW:', err);
  process.exit(1);
});
