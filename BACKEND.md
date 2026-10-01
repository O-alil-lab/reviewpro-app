# ReviewPro — Documentation Backend

## Vue d'ensemble

ReviewPro est une plateforme SaaS multi-tenant de collecte et d'analyse d'avis patients pour les médecins marocains. Le backend est un **Cloudflare Worker** unique (`_worker.js`) qui gère toute la logique métier, l'authentification, l'IA et les accès base de données.

---

## Stack technique

| Composant | Technologie |
|-----------|-------------|
| Runtime | Cloudflare Workers (Edge, V8 isolates) |
| Base de données | Cloudflare D1 (SQLite) — `reviewpro-db` |
| Sessions | Cloudflare KV — `SESSIONS_KV` |
| Tokens patients | Cloudflare KV — `TOKENS_KV` |
| IA | Workers AI — `@cf/meta/llama-3.3-70b-instruct-fp8-fast` |
| Déploiement | Cloudflare Pages (`reviewpro-saas.pages.dev`) |
| CLI | Wrangler 4.x |

---

## Schéma base de données

```sql
-- Médecins (multi-tenant root)
doctors (
  id TEXT PRIMARY KEY,          -- UUID v4
  slug TEXT UNIQUE,             -- URL-friendly: "dr-meriem-casablanca"
  nom, specialite, ville, email, password_hash, telephone,
  logo_url, google_maps_url, whatsapp_assistante,
  chips_positifs TEXT,          -- JSON array de tags
  template_suggestion TEXT,     -- Template suggestion Google
  vocabulaire_positif TEXT,     -- JSON array mots-clés SEO
  langue_defaut TEXT,           -- 'fr' | 'ar' | 'darija'
  plan TEXT,                    -- 'starter' | 'essentiel' | 'avance'
  plan_expires_at TEXT,         -- ISO date, NULL si pas de plan payant
  avis_ce_mois INT,             -- Compteur mensuel d'avis
  mois_courant TEXT,            -- Format 'YYYY-MM'
  actif INT,                    -- 0 = compte désactivé
  onboarded INT,                -- 0 = première connexion, 1 = onboarding complété
  trial_ends_at TEXT,           -- NULL = compte legacy (accès permanent)
  created_at, updated_at TEXT
)

-- Patients liés à un médecin
patients (
  id TEXT PRIMARY KEY,
  doctor_id TEXT REFERENCES doctors(id),
  nom TEXT, telephone TEXT,
  UNIQUE(doctor_id, telephone)   -- Un patient unique par numéro/médecin
)

-- Tokens de collecte d'avis (48h, usage unique)
tokens (
  token TEXT PRIMARY KEY,        -- 8 chars aléatoires
  doctor_id TEXT, patient_id TEXT,
  used INTEGER DEFAULT 0,
  expires_at TEXT
)

-- Avis patients
feedbacks (
  id TEXT PRIMARY KEY,
  doctor_id TEXT, patient_id TEXT,
  canal TEXT,                    -- 'WHATSAPP' | 'SMS' | 'QR' | 'WA'
  note INTEGER,                  -- 1-5
  commentaire TEXT,
  chips_selected TEXT,           -- JSON array
  sentiment_ia TEXT,             -- 'POSITIF' | 'NEGATIF' | 'NON_APPELE'
  type_final TEXT,               -- 'POSITIF' | 'NEGATIF'
  suggestion_ia TEXT,            -- Suggestion Google générée par l'IA
  seo_score INTEGER,             -- Score SEO /100
  seo_specialite, seo_ville, seo_longueur, ... INTEGER, -- Critères SEO
  vers_google INTEGER,           -- 1 si patient a cliqué "Publier sur Google"
  traite INTEGER, traite_at TEXT, -- Suivi avis négatifs
  created_at TEXT
)

-- Sessions médecin (cookie HttpOnly)
sessions (
  token TEXT PRIMARY KEY,
  doctor_id TEXT REFERENCES doctors(id),
  expires_at TEXT               -- 7 jours
)

-- Demandes d'upgrade plan
upgrade_requests (id, doctor_id, statut, created_at)

-- Journal d'actions admin
audit_log (id, action, actor, target_id, detail, ip, created_at)
```

---

## Système de plans et trial

### Plans disponibles

| Plan | Quota avis/mois | Prix |
|------|----------------|------|
| `starter` | 10 | Gratuit (trial) |
| `essentiel` | 100 | Payant |
| `avance` | 9 999 | Payant |

### Logique d'accès (`getTrialStatus`)

```
trial_ends_at = NULL  →  Compte legacy : accès permanent (isLegacy = true)
trial_ends_at > now   →  En trial : accès complet (inTrial = true)
trial_ends_at < now   →  Trial expiré
  + plan payant valide →  Accès complet (isPaidPremium = true)
  + pas de plan payant →  Bloqué (trialExpired = true)
```

Un plan payant est valide si : `plan IN ('essentiel','avance','premium')` ET `plan_expires_at > now`.

---

## Authentification

### Hashage des mots de passe

PBKDF2-SHA256, 100 000 itérations, sel de 16 octets aléatoires.

```
Format stocké : "pbkdf2:{saltHex}:{hashHex}"
```

Compatible avec WebCrypto API (Worker) et Node.js `crypto.pbkdf2`.

### Sessions

- Création : cookie `session=TOKEN; HttpOnly; SameSite=Lax; Path=/; Max-Age=604800`
- Stockage : Cloudflare KV avec TTL de 7 jours
- Validation : `getDoctor(env, request)` lit le cookie → KV → DB

---

## Endpoints API

### Publics (sans authentification)

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| POST | `/api/auth/inscription` | Créer un compte médecin |
| POST | `/api/auth/login` | Connexion |
| POST | `/api/auth/logout` | Déconnexion |
| GET | `/api/doctor-info?slug=` | Info publique médecin (QR poster) |
| GET | `/api/form-config?token=` ou `?slug=` | Config formulaire patient |
| POST | `/api/feedback` | Soumettre un avis patient |
| POST | `/api/track-google` | Marquer "publié sur Google" |
| GET | `/r/{TOKEN}` | Redirection token → formulaire |

### Médecin (session requise)

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| GET | `/api/me` | Profil complet + statut trial/plan |
| GET | `/api/dashboard` | Stats dashboard (compteurs, avis récents) |
| GET | `/api/config` | Config personnalisable médecin |
| PUT/POST | `/api/config` | Mettre à jour la config |
| POST | `/api/onboarding` | Compléter l'onboarding |
| GET/POST | `/api/patients` | Liste/créer patients |
| POST | `/api/tokens/generate` | Générer token (48h) pour un patient |
| GET | `/api/feedbacks` | Liste des avis (filtres: type, canal, period, limit) |
| PATCH | `/api/feedbacks/{id}/traite` | Marquer avis négatif comme traité |
| GET | `/api/notifications` | Avis négatifs non traités |
| POST | `/api/auth/change-password` | Changer mot de passe |

### Admin (header `X-Admin-Key` requis)

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| GET | `/api/admin/stats` | Stats globales SaaS |
| GET | `/api/admin/doctors` | Liste tous les médecins |
| POST | `/api/admin/create-doctor` | Créer un compte médecin |
| POST | `/api/admin/set-plan` | Changer le plan d'un médecin |
| POST | `/api/admin/delete-doctor` | Supprimer un médecin (cascade) |
| GET | `/api/admin/upgrade-requests` | Demandes d'upgrade en attente |
| POST | `/api/admin/handle-upgrade` | Approuver/refuser une upgrade |

---

## Flux de collecte d'avis

```
Médecin → POST /api/patients         → Créer patient (nom + téléphone)
        → POST /api/tokens/generate   → Obtenir token + lien WhatsApp
        → WhatsApp/SMS au patient     → Lien /r/{TOKEN}

Patient → GET /r/{TOKEN}              → Validation + redirect /form?token=
        → GET /api/form-config?token= → Config médecin (chips, template, langue)
        → [Remplit le formulaire]
        → POST /api/feedback          → Analyse IA + score SEO + suggestion Google
        → Résultat page /result       → Bouton "Publier sur Google"
        → POST /api/track-google      → Marquer vers_google=1
```

---

## Pipeline IA (handleFeedback)

### Décision de sentiment

```
note >= 4          → type_final = 'POSITIF' (pas d'IA appelée)
note <= 2          → type_final = 'NEGATIF' (pas d'IA appelée)
note = 3 + comment → Llama 3.1-8B Fast : "POSITIF" ou "NEGATIF"
note = 3 sans comm → type_final = 'NEGATIF'
```

### Génération de suggestion Google (avis POSITIFS)

Agent 3 étapes avec Llama 3.3-70B :
1. **Étape 1** — Rédaction suggestion (style naturel, mots-clés SEO, nom médecin, ville)
2. **Étape 2** — Scoring SEO avec bge-m3 embeddings (similarité sémantique)
3. **Fallback** — Template médecin `{nom} {specialite} {ville}` si IA échoue

### Score SEO (/100)

| Critère | Points |
|---------|--------|
| Mention spécialité | 15 |
| Mention ville | 15 |
| Longueur 80-300 chars | 20 |
| Chips utilisées | 20 |
| Phrases naturelles | 15 |
| Vocabulaire positif | 10 |
| Pas de répétition | 5 |

---

## Sécurité

- Mots de passe : PBKDF2-SHA256 (100k itérations), jamais stockés en clair
- Sessions : HttpOnly cookie, TTL 7j, stockées en KV (invalidation côté serveur)
- Tokens patients : 8 chars aléatoires, usage unique, expiration 48h, stockés KV+DB
- Admin : clé secrète via variable d'environnement Cloudflare (`ADMIN_SECRET`)
- Quota mensuel : vérification DB à chaque soumission (`avis_ce_mois` + `mois_courant`)
- Trial check : à chaque endpoint protégé via `getTrialStatus(doctor)`

---

## Variables d'environnement Cloudflare

| Variable | Rôle |
|----------|------|
| `ADMIN_SECRET` | Clé d'accès panel super-admin |
| `BASE_URL` | URL de base (défaut: `https://reviewpro-saas.pages.dev`) |
| `DB` | Binding D1 `reviewpro-db` |
| `SESSIONS_KV` | Binding KV pour sessions |
| `TOKENS_KV` | Binding KV pour tokens patients |
| `AI` | Binding Workers AI |

---

## Déploiement

```bash
# Déployer sur Cloudflare Pages
npx wrangler pages deploy . --project-name reviewpro-saas

# Exécuter une requête SQL sur la DB de production
npx wrangler d1 execute reviewpro-db --remote --command "SELECT ..."

# Mettre à jour un secret
echo "valeur" | npx wrangler pages secret put NOM_SECRET --project-name reviewpro-saas
```
