# Règles de Développement - Thièsdn Billetterie

## 1. Séparation Stricte des Rôles (CRITIQUE)
- L'interface ne doit JAMAIS mélanger les vues.
- Un utilisateur avec le rôle `user` (Client) ne doit voir que : Accueil, Mes Billets, Mon Profil. Il ne doit JAMAIS voir les boutons "Créer un événement", "Modération" ou "Finances".
- Un utilisateur avec le rôle `promoter` (Promoteur/Artiste) ne doit voir que : Mes Événements, Créer un événement, Mes Ventes, Mon Profil. Il ne doit pas voir la modération globale ni les billets des clients.
- Un `admin` voit tout, mais doit avoir un bouton "Mode Visiteur" pour tester l'expérience client.
- Les routes (React Router) doivent être protégées côté client ET côté serveur (Supabase RLS).

## 2. Design System (Nocturnal Elegance)
- Couleurs : Noir profond (#0a0a0a), Violet électrique (#8A2BE2), Or chaud (#E9C349).
- Toujours utiliser TailwindCSS.
- Les composants doivent être responsives (Mobile-first).

## 3. Qualité du Code
- TypeScript strict : Interdiction d'utiliser `any`.
- Toujours typer les réponses de Supabase.
- Ne jamais exposer les clés secrètes (service_role) dans le frontend.

## 4. Paiement Manuel
- Le flux Wave/OM est manuel. Ne jamais simuler un webhook de paiement réel sans confirmation administrative.
- Aucun billet ne doit être émis avant que l'admin ait validé la commande.
