# Intégration

## src/App.tsx
```tsx
import { lazy, Suspense } from "react";
const LandingShowcaseView = lazy(() => import("./views/LandingShowcaseView"));
// dans <Routes> :
<Route path="/showcase" element={<Suspense fallback={null}><LandingShowcaseView /></Suspense>} />
<Route path="/presentation" element={<Suspense fallback={null}><LandingShowcaseView /></Suspense>} />
```

## Header (à côté de « Connexion »)
```tsx
<Link to="/showcase" className="text-[#E9C349] hover:text-[#F5F5F5] transition-colors">Découvrir la Plateforme</Link>
```

## Dépendances (si absentes)
npm i framer-motion lucide-react react-router-dom
Polices : Montserrat + Inter (Google Fonts dans index.html).
