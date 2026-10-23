---
name: verification-ui
description: Vérifie que l'interface respecte la séparation des rôles avant de valider un composant.
---

# Instructions
Quand tu modifies un composant d'interface (Header, Sidebar, Routes), tu DOIS vérifier :
1. Est-ce que ce composant est visible par un utilisateur non connecté ? Si oui, est-ce qu'il ne montre pas d'options d'admin ?
2. Est-ce que les menus latéraux (Sidebar) changent en fonction du rôle de l'utilisateur connecté ?
3. Si je te demande de créer un bouton "Créer un événement", tu dois d'abord me demander : "Ce bouton doit-il être visible par tous ou seulement par les promoteurs/admins ?"
