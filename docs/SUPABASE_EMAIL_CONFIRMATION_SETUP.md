# Guide de Configuration — Vérification Email Native Supabase
**Projet : Thièsdn Billetterie**  
**Compte Officiel :** `thiesdaysandnight@gmail.com`  
**Site de Production :** `https://thiesdn.mgartswork.site/`

---

## 1. Activation dans le Tableau de Bord Supabase

1. Connectez-vous sur votre tableau de bord Supabase : [https://supabase.com/dashboard/project/jgvuzlchemqcfygsylln](https://supabase.com/dashboard/project/jgvuzlchemqcfygsylln)
2. Dans le menu de gauche, rendez-vous dans :  
   👉 **Authentication** > **Providers** > **Email**.
3. Assurez-vous que les options suivantes sont configurées :
   - ✅ **Enable Email provider** : **ACTIVÉ (ON)**
   - ✅ **Confirm email** : **ACTIVÉ (ON)** *(Oblige chaque nouvel inscrit à cliquer sur le lien avant de pouvoir acheter ou créer un événement)*.
   - ✅ **Secure email change** : **ACTIVÉ (ON)**
4. Cliquez sur **Save**.

---

## 2. Configuration des URLs de Redirection (Site URL & Redirect URLs)

Dans **Authentication** > **URL Configuration** :
1. **Site URL** :
   ```
   https://thiesdn.mgartswork.site/
   ```
2. **Redirect URLs** (Ajoutez ces deux URLs dans la liste) :
   ```
   https://thiesdn.mgartswork.site/*
   https://thiesdn-billetterie.vercel.app/*
   http://localhost:5173/*
   ```
3. Cliquez sur **Save**.

---

## 3. Template Officiel de l'Email de Confirmation (Confirm signup)

Dans **Authentication** > **Email Templates** > **Confirm signup** :

### Sujet de l'Email (Subject) :
```
Activez votre compte — Thièsdn Billetterie Officielle
```

### Corps du Message (Body) en HTML — Design "Nocturnal Elegance" :
```html
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Activez votre compte Thièsdn</title>
</head>
<body style="margin: 0; padding: 0; background-color: #0A0A0A; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #FFFFFF;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #0A0A0A; padding: 40px 15px;">
    <tr>
      <td align="center">
        <!-- Container Principal -->
        <table role="presentation" width="100%" style="max-width: 540px; background-color: #171717; border-radius: 24px; border: 1px solid rgba(138, 43, 226, 0.35); overflow: hidden; box-shadow: 0 20px 40px rgba(0, 0, 0, 0.7);">
          
          <!-- Header avec Logo Thièsdn -->
          <tr>
            <td align="center" style="padding: 35px 20px 20px 20px; background: linear-gradient(180deg, rgba(138, 43, 226, 0.2) 0%, rgba(23, 23, 23, 0) 100%);">
              <img src="https://thiesdn.mgartswork.site/logo-tight.png" alt="Thièsdn Billetterie" width="110" style="display: block; border-radius: 16px; background-color: #FFFFFF; padding: 8px;" />
              <h1 style="color: #E9C349; font-size: 22px; font-weight: 800; letter-spacing: 2px; text-transform: uppercase; margin: 18px 0 4px 0;">
                THIESDN <span style="color: #FFFFFF; font-weight: 400;">BILLETTERIE</span>
              </h1>
              <p style="color: #DCB8FF; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1.5px; margin: 0;">
                La billetterie officielle des événements de prestige
              </p>
            </td>
          </tr>

          <!-- Corps du message -->
          <tr>
            <td style="padding: 20px 35px 35px 35px;">
              <h2 style="color: #FFFFFF; font-size: 18px; font-weight: 700; margin: 0 0 12px 0;">
                Bienvenue sur Thièsdn !
              </h2>
              <p style="color: #D1D5DB; font-size: 14px; line-height: 1.6; margin: 0 0 24px 0;">
                Merci d'avoir rejoint la première plateforme événementielle et billetterie de prestige à Thiès, Saly, Mbour et Dakar.
              </p>
              <p style="color: #D1D5DB; font-size: 14px; line-height: 1.6; margin: 0 0 28px 0;">
                Pour sécuriser votre compte, débloquer la réservation de vos pass avec <strong>Wave / Orange Money</strong> et accéder à vos billets numériques avec QR Code, veuillez confirmer votre adresse email en cliquant sur le bouton ci-dessous :
              </p>

              <!-- Bouton d'Action Or & Violet -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-bottom: 28px;">
                <tr>
                  <td align="center">
                    <a href="{{ .ConfirmationURL }}" target="_blank" style="display: inline-block; background-color: #8A2BE2; color: #FFFFFF; font-size: 14px; font-weight: 800; text-transform: uppercase; letter-spacing: 1px; text-decoration: none; padding: 15px 34px; border-radius: 14px; border: 1px solid #E9C349; box-shadow: 0 8px 20px rgba(138, 43, 226, 0.4);">
                      Confirmer mon adresse email
                    </a>
                  </td>
                </tr>
              </table>

              <div style="background-color: #0F0F0F; border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 12px; padding: 14px; margin-bottom: 24px;">
                <p style="color: #9CA3AF; font-size: 11px; line-height: 1.5; margin: 0;">
                  ⚠️ Si le bouton ne fonctionne pas, copiez-collez ce lien direct dans votre navigateur :<br/>
                  <a href="{{ .ConfirmationURL }}" style="color: #E9C349; word-break: break-all; font-size: 11px;">{{ .ConfirmationURL }}</a>
                </p>
              </div>

              <p style="color: #6B7280; font-size: 12px; line-height: 1.5; margin: 0;">
                Ce lien est valable 24 heures. Si vous n'êtes pas à l'origine de cette demande, vous pouvez ignorer cet email en toute sécurité.
              </p>
            </td>
          </tr>

          <!-- Footer Email -->
          <tr>
            <td align="center" style="padding: 20px 30px; background-color: #111111; border-top: 1px solid rgba(255, 255, 255, 0.05);">
              <p style="color: #9CA3AF; font-size: 11px; margin: 0 0 6px 0;">
                Support & Contact officiel : <a href="mailto:thiesdaysandnight@gmail.com" style="color: #E9C349; text-decoration: none;">thiesdaysandnight@gmail.com</a>
              </p>
              <p style="color: #6B7280; font-size: 10px; margin: 0;">
                © 2026 Thièsdn Billetterie • DAW Digital Arts Work by MG • Tous droits réservés.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
```

---

## 4. Vérification du Comportement dans l'Application

1. **Inscription (`AuthView.tsx`)** :
   - L'utilisateur remplit Nom, Email, Mot de passe.
   - Dès la soumission, Supabase déclenche l'envoi de l'email via son infrastructure d'authentification native.
   - L'écran affiche immédiatement :  
     **"Un email de confirmation vous a été envoyé. Cliquez sur le lien pour activer votre compte."** avec un bouton pour renvoyer le lien si nécessaire.

2. **Sécurité & Blocages Actifs** :
   - **Achat de billets** : Si un utilisateur non confirmé ou non connecté tente d'acheter un billet, le bouton affiche **"Veuillez confirmer votre email"** et un encart bloque l'achat avec le message officiel :  
     *"Veuillez confirmer votre adresse email pour continuer."*
   - **Création d'événement** : Si un organisateur n'a pas confirmé son email, le formulaire affiche une alerte bloquante et le bouton de publication est désactivé avec le message officiel :  
     *"Veuillez confirmer votre adresse email pour continuer"*.
