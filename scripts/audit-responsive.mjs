import { chromium } from 'playwright';
import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const distPath = path.join(projectRoot, 'dist');
const screenshotsDir = path.join(projectRoot, 'screenshots');

if (!fs.existsSync(screenshotsDir)) {
  fs.mkdirSync(screenshotsDir, { recursive: true });
}

// 1. Démarrer le serveur statique Express pour dist
const app = express();
app.use(express.static(distPath));
app.get('*', (req, res) => {
  res.sendFile(path.join(distPath, 'index.html'));
});

const PORT = 4173;
const server = app.listen(PORT, async () => {
  console.log(`Serveur de test démarré sur http://localhost:${PORT}`);
  
  try {
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();

    const widths = [320, 360, 390, 412, 768, 1024, 1440];
    const auditResults = [];

    console.log('\n--- DÉBUT DE LA MATRICE D\'AUDIT RESPONSIVE MOBILE-FIRST ---\n');

    for (const width of widths) {
      console.log(`\n========================================`);
      console.log(`🔍 TEST DE LARGEUR : ${width}px (Hauteur 844px)`);
      console.log(`========================================`);

      await page.setViewportSize({ width, height: 844 });
      await page.goto(`http://localhost:${PORT}`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(1000);

      // INJECTION OBLIGATOIRE DE LA DIRECTIVE 7 DU USER :
      // "injecte html,body,#root{overflow-x:visible!important} avant de mesurer"
      await page.addStyleTag({
        content: 'html, body, #root { overflow-x: visible !important; }'
      });

      // Assertions
      const pageMetrics = await page.evaluate(() => {
        const innerWidth = window.innerWidth;
        const scrollWidth = document.documentElement.scrollWidth;

        // 1. Liste des éléments dont right > innerWidth
        const overflowElements = [];
        const allElements = document.querySelectorAll('*');
        for (const el of allElements) {
          // Ignorer les éléments invisibles ou sans taille
          const rect = el.getBoundingClientRect();
          if (rect.width > 0 && rect.right > innerWidth + 1.5) {
            overflowElements.push({
              tag: el.tagName.toLowerCase(),
              className: (el.className || '').toString().slice(0, 60),
              right: Math.round(rect.right),
              innerWidth: innerWidth,
              delta: Math.round(rect.right - innerWidth)
            });
          }
        }

        // 2. Images cassées : naturalWidth === 0
        const brokenImages = [];
        const images = document.querySelectorAll('img');
        for (const img of images) {
          const style = window.getComputedStyle(img);
          const isVisible = style.display !== 'none' && style.visibility !== 'hidden' && (img.offsetParent !== null || img.offsetWidth > 0);
          if (isVisible && img.complete && img.naturalWidth === 0) {
            brokenImages.push({
              src: (img.src || '').slice(0, 80),
              alt: img.alt || ''
            });
          }
        }

        // 3. Contenu masqué par la BottomNav
        let bottomNavOverlap = false;
        const nav = document.querySelector('nav');
        if (nav && window.innerWidth < 1024) {
          const navRect = nav.getBoundingClientRect();
          const main = document.querySelector('main');
          const footer = document.querySelector('footer');
          const targetEl = footer || main;
          if (targetEl) {
            const targetRect = targetEl.getBoundingClientRect();
            // Si le bas du footer est recouvert sans possibilité de scroll
            const windowHeight = window.innerHeight;
            const scrollMaxY = document.documentElement.scrollHeight - window.innerHeight;
            // On vérifie que le padding-bottom de main ou du footer est suffisant (>= navRect.height)
            const mainStyle = window.getComputedStyle(main);
            const pbValue = parseFloat(mainStyle.paddingBottom) || 0;
            if (pbValue < 60) {
              bottomNavOverlap = true;
            }
          }
        }

        return {
          scrollWidth,
          innerWidth,
          hasHorizontalScroll: scrollWidth > innerWidth,
          overflowElementsCount: overflowElements.length,
          overflowElements: overflowElements.slice(0, 5),
          brokenImagesCount: brokenImages.length,
          brokenImages,
          bottomNavOverlap
        };
      });

      console.log(`📐 scrollWidth: ${pageMetrics.scrollWidth}px | innerWidth: ${pageMetrics.innerWidth}px`);
      console.log(`🚨 Éléments débordants (right > innerWidth): ${pageMetrics.overflowElementsCount}`);
      if (pageMetrics.overflowElementsCount > 0) {
        console.log(`   Détails:`, JSON.stringify(pageMetrics.overflowElements, null, 2));
      }
      console.log(`🖼️ Images cassées (naturalWidth === 0): ${pageMetrics.brokenImagesCount}`);
      if (pageMetrics.brokenImagesCount > 0) {
        console.log(`   Images:`, JSON.stringify(pageMetrics.brokenImages, null, 2));
      }
      console.log(`🧭 Chevauchement BottomNav: ${pageMetrics.bottomNavOverlap ? 'OUI ❌' : 'NON (Protégé) ✅'}`);

      // Capture d'écran
      const screenshotPath = path.join(screenshotsDir, `audit-home-${width}px.png`);
      await page.screenshot({ path: screenshotPath, fullPage: false });
      console.log(`📸 Capture enregistrée: ${screenshotPath}`);

      auditResults.push({
        width,
        ...pageMetrics
      });
    }

    // Test de la modale détail d'événement à 360px (mobile standard)
    console.log(`\n========================================`);
    console.log(`🔍 TEST DE LA MODALE DÉTAIL D'ÉVÉNEMENT (360px)`);
    console.log(`========================================`);
    await page.setViewportSize({ width: 360, height: 844 });
    await page.goto(`http://localhost:${PORT}`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);

    // Clic sur la carte d'événement (diner de galla)
    const eventCard = await page.locator('div:has-text("diner de galla")').last();
    if (await eventCard.isVisible()) {
      await eventCard.click();
      await page.waitForTimeout(1500);

      // Assertions dans la modale
      const modalMetrics = await page.evaluate(() => {
        const modal = document.querySelector('[role="dialog"]') || document.querySelector('.bg-\\[\\#0A0A0A\\]');
        const brokenImages = [];
        for (const img of document.querySelectorAll('img')) {
          if (img.complete && img.naturalWidth === 0) {
            brokenImages.push({ src: img.src, alt: img.alt });
          }
        }
        return {
          isOpen: !!modal,
          brokenImagesCount: brokenImages.length,
          brokenImages
        };
      });

      console.log(`📌 Modale ouverte: ${modalMetrics.isOpen ? 'OUI ✅' : 'NON ❌'}`);
      console.log(`🖼️ Images cassées dans la modale: ${modalMetrics.brokenImagesCount}`);

      const modalScreenshot = path.join(screenshotsDir, 'audit-modal-360px.png');
      await page.screenshot({ path: modalScreenshot });
      console.log(`📸 Capture modale: ${modalScreenshot}`);
    }

    // Test de la page /showcase
    console.log(`\n========================================`);
    console.log(`🔍 TEST DE LA PAGE /SHOWCASE (360px & 1024px)`);
    console.log(`========================================`);
    for (const w of [360, 1024]) {
      await page.setViewportSize({ width: w, height: 844 });
      await page.goto(`http://localhost:${PORT}`, { waitUntil: 'networkidle' });
      // Clic sur le bouton Partenariat
      const partBtn = await page.locator('button[title*="Partenariat"]').first();
      if (await partBtn.isVisible()) {
        await partBtn.click();
        await page.waitForTimeout(1200);
        const showcaseScreenshot = path.join(screenshotsDir, `audit-showcase-${w}px.png`);
        await page.screenshot({ path: showcaseScreenshot });
        console.log(`📸 Capture Showcase ${w}px: ${showcaseScreenshot}`);
      }
    }

    await browser.close();
    server.close();
    console.log('\n✅ AUDIT PLAYWRIGHT TERMINÉ AVEC SUCCÈS !\n');
    process.exit(0);
  } catch (err) {
    console.error('Erreur durant l\'audit Playwright:', err);
    server.close();
    process.exit(1);
  }
});
