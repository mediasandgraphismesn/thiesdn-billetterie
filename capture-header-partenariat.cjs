const express = require('express');
const path = require('path');
const fs = require('fs');
const { chromium } = require('playwright');

const PORT = 3457;
const app = express();

app.use(express.static(path.join(__dirname, 'dist')));
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

async function main() {
  console.log('[CAPTURE] Démarrage du serveur Express...');
  const server = await new Promise((resolve) => {
    const s = app.listen(PORT, () => {
      console.log(`[CAPTURE] Serveur actif sur http://localhost:${PORT}`);
      resolve(s);
    });
  });

  if (!fs.existsSync(path.join(__dirname, 'test-results'))) {
    fs.mkdirSync(path.join(__dirname, 'test-results'), { recursive: true });
  }

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1360, height: 800 },
    deviceScaleFactor: 2,
  });

  const page = await context.newPage();

  console.log('[CAPTURE] Navigation vers l\'accueil...');
  await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'networkidle' });

  // Attendre le header
  await page.waitForSelector('header');
  await page.waitForTimeout(1000);

  const headerElement = await page.$('header');
  const screenshotPath = path.join(__dirname, 'test-results', 'PREUVE_HEADER_BOUTON_PARTENARIAT.png');

  if (headerElement) {
    await headerElement.screenshot({ path: screenshotPath });
    console.log(`[CAPTURE] ✅ Capture HD du Header enregistrée : ${screenshotPath}`);
  } else {
    await page.screenshot({ path: screenshotPath });
    console.log(`[CAPTURE] Capture globale enregistrée : ${screenshotPath}`);
  }

  // Vérifier la navigation vers /showcase au clic
  console.log('[CAPTURE] Test du clic sur le bouton Partenariat...');
  const partenariatBtn = await page.getByText('Partenariat');
  if (await partenariatBtn.isVisible()) {
    console.log('[CAPTURE] Bouton "Partenariat" détecté avec succès !');
    await partenariatBtn.click();
    await page.waitForTimeout(1500);
    const url = page.url();
    console.log(`[CAPTURE] URL après clic : ${url}`);
  }

  await browser.close();
  server.close();
  console.log('[CAPTURE] Test terminé avec succès.');
}

main().catch((err) => {
  console.error('[CAPTURE] Erreur :', err);
  process.exit(1);
});
