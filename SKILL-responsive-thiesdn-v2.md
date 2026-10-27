---
name: responsive-fullstack-thiesdn-v2
description: Référentiel et guide maître d'ingénierie responsive mobile-first v2 pour Thièsdn Billetterie (320px à 1920px), intégrant la résolution des 11 anomalies Android, le SafeImage anti-rate-limit Imgur/Weserv, ModalShell, Leaflet isolate et tests Playwright.
---

# GUIDE MAÎTRE RESPONSIVE MOBILE-FIRST V2 — THIÈSDN BILLETTERIE

## 1. RÔLE & PHILOSOPHIE
Ingénieur Senior Frontend Mobile-First (React 19, TypeScript, Tailwind CSS, Vite PWA) spécialisé dans les contraintes des réseaux et terminaux mobiles d'Afrique de l'Ouest (Android Chrome, écrans 320px–412px, safe areas, barre d'URL dynamique).

## 2. LES 7 DIRECTIVES MAJEURES V2 (POST-ENQUÊTE)

1. **Enquête & Diagnostic Préalables Validés** :
   - Cause racine de l'affiche "diner de galla" : Imgur bloque les requêtes de `images.weserv.nl` avec un code HTTP 429. Weserv renvoie donc une erreur 404, ce qui provoquait l'échec d'affichage de l'image et l'apparition du texte `alt` brut sur la carte.
   - `getOptimizedImageUrl` doit court-circuiter Imgur (ou servir directement l'URL d'origine sans passer par Weserv).
   - `SafeImage` doit tenter l'URL directe en fallback avant d'afficher un placeholder stylisé, et ne JAMAIS laisser paraître de texte `alt` en texte brut.

2. **CSS Global Purifié** :
   - Retirer impérativement `* { min-width: 0 }` d'`index.css` car cela casse les SVG, flex items et composants tiers.
   - Appliquer `min-w-0` uniquement et explicitement aux zones `flex` de texte.
   - Supprimer `max-width: 100vw;` et le remplacer par `max-width: 100%; overflow-x: clip;` sur `html, body, #root`.

3. **Élimination des Largeurs Fixes en Pixels** :
   - Remplacer tous les `max-w-[140px]`, `max-w-[110px]`, `max-w-[120px]` des puces et badges par `max-w-full min-w-0 truncate`.
   - Zéro largeur fixe en px pour les conteneurs textuels.

4. **Design des Modales & Boutons Tactiles** :
   - Fond de modale : `#0A0A0A` / `#121118` (bannir définitivement `#171717`).
   - Bouton "Réserver" et boutons d'action majeurs : hauteur `h-12` (48px) sur mobile pour une zone tactile optimale.

5. **Composants & Isolation de Calques** :
   - Création de `ModalShell` unifié pour toutes les modales (`EventDetailModal`, `TicketPassModal`, `AccreditationBadgeModal`, `PhysicalTicketsModal`, `TermsOfServiceModal`, `AssignTicketModal`).
   - Isolation de Leaflet (`MapView.tsx`) : stacking context `isolate z-0` et limitation stricte des `.leaflet-pane` pour éviter toute superposition sur le Header (`z-40`) ou les Modales (`z-50`).
   - `PWAInstallPrompt` : positionné au-dessus de la BottomNav via `bottom-[calc(var(--nav-h)+env(safe-area-inset-bottom)+12px)]` avec `z-[60]`.
   - Désactivation globale de `hover:scale` sur mobile tactile via `@media (hover: none) { [class*="hover:scale"] { transform: none !important; } }`.
   - Tableaux responsifs : transformation en cartes empilées sous 768px (`md:table`).

6. **Validation Automatisée Playwright** :
   - Matrice complète : `/`, `/explorer`, `/connexion`, `/profil`, `/admin`, `/scan` (postes scanner), `/showcase`, détail événement.
   - Largeurs : 320, 360, 390, 412, 768, 1024, 1440.
   - Assertions obligatoires :
     * `scrollWidth <= innerWidth`
     * Aucun élément interactif < 44x44px
     * Aucune image avec `naturalWidth === 0` visible
     * Aucun texte alt visible
     * Contenu bas non masqué par la BottomNav
   - `.gitignore` : inclure obligatoirement `screenshots/` et `test-results/`.

7. **Gestion Rigoureuse des Images Réelles** :
   - Si `SafeImage` affiche le fallback sur des événements réels en base, identifier et documenter la cause racine au lieu de déclarer le bug corrigé.

## 3. RÈGLES DE DÉPLOIEMENT & SÉCURITÉ
- Aucun `git push --force`.
- Commits atomiques avec `npm run build` à 0 erreur avant chaque validation.
- Préservation absolue de la logique métier (Supabase, Wave/OM, RLS, QR).
