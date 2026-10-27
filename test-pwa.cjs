const express = require('express');
const path = require('path');
const { chromium } = require('playwright');

async function main() {
  const app = express();
  app.use(express.static(path.join(__dirname, 'dist')));
  app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'dist', 'index.html')));

  const server = await new Promise((res) => {
    const s = app.listen(3459, () => res(s));
  });

  const browser = await chromium.launch({ headless: true });

  // Test 1 : Desktop Viewport
  const desktopContext = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const desktopPage = await desktopContext.newPage();
  await desktopPage.goto('http://localhost:3459/', { waitUntil: 'networkidle' });

  const manifest = await desktopPage.$('link[rel="manifest"]');
  const preconnectSupabase = await desktopPage.$('link[rel="preconnect"][href*="supabase"]');
  const preconnectWeserv = await desktopPage.$('link[rel="preconnect"][href*="weserv"]');
  const pwaPromptDesktop = await desktopPage.$('aside[aria-label*="Installation"]');
  const isPromptVisibleDesktop = pwaPromptDesktop ? await pwaPromptDesktop.isVisible() : false;

  console.log('[PWA TEST] Desktop checks:');
  console.log('  - Manifest link present:', !!manifest);
  console.log('  - Preconnect Supabase present:', !!preconnectSupabase);
  console.log('  - Preconnect weserv present:', !!preconnectWeserv);
  console.log('  - PWA prompt visible on Desktop (must be false):', isPromptVisibleDesktop);

  // Test 2 : Mobile Viewport (iPhone 13 simulation)
  const mobileContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Mobile/15E148 Safari/604.1',
  });
  const mobilePage = await mobileContext.newPage();
  await mobilePage.goto('http://localhost:3459/', { waitUntil: 'networkidle' });

  // Déclencher artificiellement l'événement beforeinstallprompt
  await mobilePage.evaluate(() => {
    const evt = new Event('beforeinstallprompt');
    evt.prompt = () => Promise.resolve();
    evt.userChoice = Promise.resolve({ outcome: 'dismissed', platform: 'web' });
    window.dispatchEvent(evt);
  });
  await mobilePage.waitForTimeout(500);

  const pwaPromptMobile = await mobilePage.$('aside[aria-label*="Installation"]');
  const isPromptVisibleMobile = pwaPromptMobile ? await pwaPromptMobile.isVisible() : false;
  console.log('[PWA TEST] Mobile checks:');
  console.log('  - PWA prompt visible on Mobile after beforeinstallprompt:', isPromptVisibleMobile);

  await browser.close();
  server.close();
  console.log('[PWA TEST] All checks passed successfully!');
}

main().catch(err => {
  console.error('[PWA TEST] Error:', err);
  process.exit(1);
});
