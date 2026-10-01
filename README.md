# ReviewPro SaaS

Plateforme SaaS de collecte et d'analyse d'avis patients pour les médecins marocains.

## Déploiement

- **Production** : [https://reviewpro-saas.pages.dev](https://reviewpro-saas.pages.dev)
- **Admin panel** : [https://reviewpro-saas.pages.dev/admin.html](https://reviewpro-saas.pages.dev/admin.html)
- **Hébergement** : Cloudflare Pages + D1 + KV + Workers AI

## Fonctionnalités

- Collecte d'avis via WhatsApp, SMS et QR code
- Analyse de sentiment par IA (Llama 3.3-70B)
- Génération de suggestions Google optimisées SEO
- Score SEO automatique /100
- Tableau de bord multi-tenant par médecin
- Système de plans (starter / essentiel / avancé)
- Trial 7 jours automatique à l'inscription

## Stack technique

| Couche | Technologie |
|--------|-------------|
| Frontend | HTML / CSS / JS vanilla |
| Backend | Cloudflare Worker (`_worker.js`) |
| Base de données | Cloudflare D1 (SQLite) |
| Sessions | Cloudflare KV |
| IA | Workers AI (Llama 3.3-70B) |
| Déploiement | Cloudflare Pages |

## Documentation

- [BACKEND.md](./BACKEND.md) — Architecture backend, API, DB, sécurité
- [FRONTEND.md](./FRONTEND.md) — Pages HTML, flux utilisateur, patterns JS

## Démarrage rapide

```bash
# Installer les dépendances
npm install

# Déployer sur Cloudflare Pages
npx wrangler pages deploy . --project-name reviewpro-saas

# Exécuter une requête sur la DB de production
npx wrangler d1 execute reviewpro-db --remote --command "SELECT * FROM doctors"
```

## Structure du projet

```
ReviewPro/
├── _worker.js          Backend (Cloudflare Worker)
├── _redirects          Redirections Cloudflare Pages
├── _headers            Headers de sécurité HTTP
├── wrangler.jsonc      Config Cloudflare (D1, KV, AI)
├── schema.sql          Schéma base de données
├── index.html          Landing page
├── login.html          Connexion médecin
├── inscription.html    Inscription
├── onboarding.html     Configuration initiale
├── dashboard.html      Tableau de bord médecin
├── form.html           Formulaire patient
├── result.html         Page résultat avis
├── qr.html             Générateur QR code
├── admin.html          Panel super-admin
├── token-error.html    Page d'erreur token
├── BACKEND.md          Documentation backend
└── FRONTEND.md         Documentation frontend
```
