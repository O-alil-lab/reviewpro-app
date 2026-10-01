# ReviewPro SaaS — Architecture Complète
> Document généré le 05/05/2026 — État exact du système en production  
> URL de production : **https://reviewpro-saas.pages.dev**  
> Repo GitHub : **https://github.com/O-alil-lab/reviewpro-saas**  
> Dernier commit : `e84072f` — fix doctor_seo_v2 KV + inscription badge

---

## 1. Vue d'ensemble

```
┌──────────────────────────────────────────────────────────────────┐
│                     CLOUDFLARE PAGES                             │
│                  reviewpro-saas.pages.dev                        │
│                                                                  │
│   ┌─────────────────┐    ┌──────────────────────────────────┐   │
│   │  Static HTML    │    │    _worker.js  (Edge Worker)     │   │
│   │   10 fichiers   │    │   1 359 lignes · ES Modules      │   │
│   └─────────────────┘    └──────────────────────────────────┘   │
│             │                          │                         │
│             └──────────────┬───────────┘                        │
│                            ▼                                     │
│   ┌─────────────────────────────────────────────────────────┐   │
│   │                    BINDINGS                             │   │
│   │  DB          → D1 SQLite  (reviewpro-db)                │   │
│   │  SESSIONS_KV → KV         (sessions + cache SEO)        │   │
│   │  TOKENS_KV   → KV         (tokens WhatsApp 48h)         │   │
│   │  AI          → Workers AI (pipeline 3 modèles)          │   │
│   │  ASSETS      → Static files (HTML servis directement)   │   │
│   │                                                         │   │
│   │  Env vars: ADMIN_EMAIL · ADMIN_SECRET · ADMIN_WA        │   │
│   │            BASE_URL                                     │   │
│   └─────────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────────┘
```

---

## 2. Infrastructure Cloudflare

### 2.1 Compte & Projet

| Élément | Valeur |
|---------|--------|
| Compte | `Oussama-alilou@um5r.ac.ma` |
| Account ID | `cb2ae19b37f0f121153a05739e2a8698` |
| Projet Pages | `reviewpro-saas` |
| URL production | `https://reviewpro-saas.pages.dev` |
| Déploiement | Direct upload `wrangler pages deploy` (pas de CI/CD GitHub) |
| Git repo | `github.com/O-alil-lab/reviewpro-saas` |
| Token wrangler | `cfut_xxxx...` (Pages:Edit — voir Cloudflare Dashboard) |

### 2.2 Bindings Pages

| Binding | Type | ID / Nom | Usage |
|---------|------|----------|-------|
| `DB` | D1 SQLite | `reviewpro-db` · `0b5f07e0-b73c-472f-9765-3874db25ef6d` | Base de données principale |
| `SESSIONS_KV` | KV Namespace | `95e35348173a448e8293f4bcdff87d7d` | Sessions + cache SEO + notifications trial |
| `TOKENS_KV` | KV Namespace | *(voir dashboard CF)* | Tokens WhatsApp mono-usage 48h |
| `AI` | Workers AI | *(auto-géré CF)* | Pipeline IA 3 modèles |
| `ASSETS` | Static | Pages assets | Sert les 10 fichiers HTML statiques |

### 2.3 Variables d'environnement (Secrets)

| Variable | Usage |
|----------|-------|
| `ADMIN_EMAIL` | Email super-admin (vérifié via header `CF-Access-Authenticated-User-Email`) |
| `ADMIN_SECRET` | Clé secrète admin (header `X-Admin-Key`) |
| `ADMIN_WA` | Numéro WhatsApp admin fallback (si KV `admin_wa` vide) |
| `BASE_URL` | `https://reviewpro-saas.pages.dev` (construit les liens WA patients) |

### 2.4 Cron Trigger

| Paramètre | Valeur |
|-----------|--------|
| Expression | `0 8 * * *` (tous les jours à 8h00 UTC) |
| Handler | `export default { async scheduled(event, env) {...} }` |
| Action | Détecte trials expirés (dernières 25h) → stocke KV `trial_expired:{id}` → `trial_notified=1` |
| Fallback HTTP | `POST /api/admin/cron` (header X-Admin-Key requis, appelable via cron-job.org) |

---

## 3. Base de données D1 — Schéma complet

### Table `doctors`

```sql
CREATE TABLE doctors (
  id                   TEXT PRIMARY KEY,       -- UUID v4
  slug                 TEXT UNIQUE NOT NULL,   -- "dr-ahmed-benali-casablanca"
  nom                  TEXT NOT NULL,          -- "Dr Ahmed Benali"
  specialite           TEXT NOT NULL,          -- "Cardiologue"
  ville                TEXT NOT NULL,          -- "Casablanca"
  email                TEXT UNIQUE NOT NULL,   -- lowercase
  password_hash        TEXT NOT NULL,          -- "pbkdf2:{salt16b}:{hash}" SHA-256 100k iter
  telephone            TEXT DEFAULT '',
  logo_url             TEXT DEFAULT '',
  google_maps_url      TEXT DEFAULT '',        -- URL review Google Maps
  whatsapp_assistante  TEXT DEFAULT '',        -- numéro WA secrétaire (format 212XXXXXXXXX)
  chips_positifs       TEXT DEFAULT '[]',      -- JSON: ["Accueil","Écoute","Professionnalisme",...]
  template_suggestion  TEXT DEFAULT '',        -- template fallback : {nom} {specialite} {ville}
  vocabulaire_positif  TEXT DEFAULT '[]',      -- JSON: ["professionnel","recommande","excellent",...]
  langue_defaut        TEXT DEFAULT 'fr',
  plan                 TEXT DEFAULT 'free',    -- 'free' | 'premium'
  plan_expires_at      TEXT,                   -- ISO date, null si free
  trial_ends_at        TEXT,                   -- ISO date = created_at + 7 jours
  trial_notified       INTEGER DEFAULT 0,      -- 1 = cron a notifié l'admin de l'expiration
  avis_ce_mois         INTEGER DEFAULT 0,      -- compteur mensuel (analytics uniquement)
  mois_courant         TEXT DEFAULT '',        -- "2026-05" (YYYY-MM)
  onboarded            INTEGER DEFAULT 0,      -- 1 = a complété l'onboarding
  actif                INTEGER DEFAULT 1,      -- 0 = désactivé par admin
  updated_at           TEXT DEFAULT (datetime('now')),
  created_at           TEXT DEFAULT (datetime('now'))
);
```

### Table `feedbacks`

```sql
CREATE TABLE feedbacks (
  id              TEXT PRIMARY KEY,            -- UUID v4
  doctor_id       TEXT NOT NULL,               -- FK → doctors.id
  patient_id      TEXT,                        -- FK → patients.id (NULL si canal QR)
  canal           TEXT DEFAULT 'QR',           -- 'QR' | 'WA'
  note            INTEGER NOT NULL,            -- 1 à 5 étoiles
  commentaire     TEXT DEFAULT '',             -- texte libre du patient
  chips_selected  TEXT DEFAULT '[]',           -- JSON: chips cochés par le patient
  sentiment_ia    TEXT DEFAULT 'NON_APPELE',   -- 'POSITIF' | 'NEGATIF' | 'NON_APPELE'
  type_final      TEXT NOT NULL,               -- 'POSITIF' | 'NEGATIF'
  suggestion_ia   TEXT,                        -- avis enrichi par IA (NULL si négatif ou fallback)
  seo_score       INTEGER,                     -- score /100 (NULL si avis négatif)
  seo_specialite  INTEGER DEFAULT 0,           -- 0 ou 25
  seo_ville       INTEGER DEFAULT 0,           -- 0 ou 20
  seo_nom         INTEGER DEFAULT 0,           -- 0 ou 15 (basé sur surname)
  seo_longueur    INTEGER DEFAULT 0,           -- 0, 8 ou 15
  seo_chips       INTEGER DEFAULT 0,           -- 0 ou 10
  seo_phrases     INTEGER DEFAULT 0,           -- 0 ou 10
  seo_vocabulaire INTEGER DEFAULT 0,           -- 0 ou 5
  seo_repetition  INTEGER DEFAULT 0,           -- legacy, toujours 0 (gardé pour compat)
  ab_variante     TEXT DEFAULT 'B',            -- test A/B (toujours 'B' actuellement)
  vers_google     INTEGER DEFAULT 0,           -- 1 = patient a cliqué "Publier sur Google Maps"
  created_at      TEXT DEFAULT (datetime('now'))
);
```

### Table `patients`

```sql
CREATE TABLE patients (
  id         TEXT PRIMARY KEY,                 -- UUID v4
  doctor_id  TEXT NOT NULL,                    -- FK → doctors.id
  nom        TEXT NOT NULL,
  telephone  TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  UNIQUE(doctor_id, telephone)                 -- un patient unique par médecin
);
```

### Table `tokens`

```sql
CREATE TABLE tokens (
  token       TEXT PRIMARY KEY,               -- 8 chars aléatoires ex: "aB3kLm9P"
  doctor_id   TEXT NOT NULL,                  -- FK → doctors.id
  patient_id  TEXT NOT NULL,                  -- FK → patients.id
  used        INTEGER DEFAULT 0,              -- 1 = déjà utilisé (mono-usage)
  expires_at  TEXT NOT NULL,                  -- now + 48h
  created_at  TEXT DEFAULT (datetime('now'))
);
```

### Table `sessions`

```sql
CREATE TABLE sessions (
  id         TEXT PRIMARY KEY,
  doctor_id  TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
  -- NOTE: Sessions gérées principalement via SESSIONS_KV (TTL 7j)
  -- Cette table est secondaire / audit seulement
);
```

### Table `upgrade_requests`

```sql
CREATE TABLE upgrade_requests (
  id         TEXT PRIMARY KEY,               -- UUID v4
  doctor_id  TEXT NOT NULL,                  -- FK → doctors.id
  statut     TEXT DEFAULT 'en_attente',      -- 'en_attente' | 'approuve' | 'refuse'
  created_at TEXT DEFAULT (datetime('now'))
);
```

---

## 4. KV Namespaces — Clés et TTL

### SESSIONS_KV (`95e35348173a448e8293f4bcdff87d7d`)

| Clé | Valeur | TTL |
|-----|--------|-----|
| `session:{UUID}` | `{ doctor_id, expires_at }` | 7 jours |
| `doctor_seo_v2:{slug}` | Profil SEO complet (voir §6) | 7 jours |
| `doctor_seo:{slug}` | *(legacy v1 — peut subsister, invalidé à chaque config update)* | — |
| `trial_expired:{doctor_id}` | `{ nom, specialite, ville, email, telephone, expired_at, notified_at }` | 30 jours |
| `admin_wa` | Numéro WA admin normalisé ex: `212612345678` | Permanent |

### TOKENS_KV

| Clé | Valeur | TTL |
|-----|--------|-----|
| `token:{TOKEN}` | `{ doctor_id, patient_id, used: bool, expires_at }` | 48h (réduit à 1h après usage) |

---

## 5. Fichiers HTML statiques

| Fichier | URL d'accès | Taille | Rôle |
|---------|-------------|--------|------|
| `index.html` | `/` | 25 KB | Landing page marketing |
| `inscription.html` | `/inscription` | 7.6 KB | Inscription médecin (badge: 7j Premium offert) |
| `login.html` | `/login` | 4.3 KB | Connexion médecin |
| `onboarding.html` | `/onboarding` | 12.5 KB | Configuration initiale profil |
| `dashboard.html` | `/dashboard` | 43.9 KB | Tableau de bord médecin (stats, avis, patients, QR, config) |
| `form.html` | `/form/[slug]` ou `/form?token=` | 15.6 KB | Formulaire patient (étoiles + chips + commentaire) |
| `result.html` | `/result` | 13.1 KB | Page résultat (badge SEO + auto-copy + guide 3 étapes + Google Maps) |
| `qr.html` | `/qr/[slug]` | 6.1 KB | Poster QR code imprimable |
| `token-error.html` | `/token-error?reason=` | 2.6 KB | Erreur lien WA (invalid / used / expired) |
| `admin.html` | `/admin` | 21.9 KB | Panel super-administrateur |

---

## 6. Pipeline IA — 5 Étapes (avis POSITIF uniquement)

```
Patient soumet note ≥ 4  (ou note=3 + sentiment IA = POSITIF)
        │
        ▼
┌──────────────────────────────────────────────────────────┐
│  ÉTAPE 0 : getDoctorSeoProfile()                         │
│  Cache KV : "doctor_seo_v2:{slug}" — TTL 7 jours        │
│  Si absent → construit depuis DB → stocke KV             │
│  Contenu :                                               │
│    { nom, surname, specialite, ville,                    │
│      seo_context: "Dr X est Y à Z.",                    │
│      target_keywords: [spec+ville, Dr+surname+spec, ...] │
│      key_qualities: chips_positifs[0:5],                 │
│      vocab_positif: vocabulaire_positif[0:5],            │
│      cached_at }                                         │
└──────────────────────────────────────────────────────────┘
        │
        ▼
┌──────────────────────────────────────────────────────────┐
│  ÉTAPE 1 : Génération                                    │
│  Modèle : @cf/meta/llama-3.3-70b-instruct-fp8-fast       │
│  Prix   : 26 668 N/M input · 204 805 N/M output  ⚠️     │
│  max_tokens : 300                                        │
│  System : expert SEO local + règles anti-hallucination   │
│  → generatedReview                                       │
│  → cleanOutput() : strip intro + limite 3 phrases        │
└──────────────────────────────────────────────────────────┘
        │
        ▼
┌──────────────────────────────────────────────────────────┐
│  ÉTAPE 2 : Scoring SEO                                   │
│  Modèle : @cf/meta/llama-3.1-8b-instruct-fast            │
│  Prix   : 4 119 N/M input · 34 868 N/M output   ⚠️     │
│  max_tokens : 150                                        │
│  → JSON { score:0-100, ville:bool, specialite:bool,      │
│           longueur_ok:bool, naturel:bool, gaps:[] }      │
│  Fallback algorithme si JSON invalide                    │
└──────────────────────────────────────────────────────────┘
        │
        ├── score < 72 ET gaps.length > 0 ?
        ▼ OUI
┌──────────────────────────────────────────────────────────┐
│  ÉTAPE 3 : Retry ciblé                                   │
│  Modèle : @cf/meta/llama-3.3-70b-instruct-fp8-fast       │
│  Prompt : "Améliore en intégrant : {gaps[0:3]}"          │
│  max_tokens : 300                                        │
│  → Remplace generatedReview si réponse valide (>30 chars)│
└──────────────────────────────────────────────────────────┘
        │
        ▼ (si input patient > 15 chars)
┌──────────────────────────────────────────────────────────┐
│  ÉTAPE 4 : Fidélité sémantique                           │
│  Modèle : @cf/baai/bge-m3                                │
│  Prix   : 1 075 N/M input                                │
│  Embed(input_patient) vs Embed(review_générée)           │
│  cosine_similarity < 0.28 → retourne null (trop distant) │
└──────────────────────────────────────────────────────────┘
        │
        ▼
┌──────────────────────────────────────────────────────────┐
│  ÉTAPE 5 : Anti-hallucination (règles strictes)          │
│  Mots interdits si ABSENTS du commentaire patient :      │
│  opération · chirurgie · intervention · anesthésie       │
│  médicament · prescription · ordonnance · scanner        │
│  biopsie · injection · greffe · hospitalisation          │
│  → Tentative sauvetage (supprime phrases contaminées)    │
│  → null si rien de salvageable                           │
└──────────────────────────────────────────────────────────┘
        │
        ▼ null → Fallback template
┌──────────────────────────────────────────────────────────┐
│  FALLBACK : Template médecin                             │
│  doctor.template_suggestion avec {nom} {specialite}      │
│  {ville} substitués                                      │
│  Défaut: "Très bon accueil. Dr X est un excellent Y à Z" │
└──────────────────────────────────────────────────────────┘
```

---

## 7. Calcul SEO Score (/100) — Algorithme local

| Critère | Points max | Condition |
|---------|-----------|-----------|
| Spécialité mentionnée | **25** | `text.includes(doctor.specialite.toLowerCase())` |
| Ville mentionnée | **20** | `text.includes(doctor.ville.toLowerCase())` |
| Nom médecin (surname) | **15** | `text.includes(surname.toLowerCase())` |
| Longueur du texte | **15** | `>120 chars` → 15 pts · `>80 chars` → 8 pts |
| Chips qualité présents | **10** | `chips_selected.length > 0` |
| Structure (≥2 phrases) | **10** | `(text.match(/[.!?]+/g) || []).length >= 2` |
| Vocabulaire positif | **5** | Un mot de `vocabulaire_positif[]` trouvé dans le texte |
| **TOTAL** | **100** | |

**Affichage dashboard** : 🏆 score ≥ 80 · ⚡ score 60-79 · (rien si < 60)

---

## 8. Système de Plans / Trial

```
Inscription
    │
    ├── trial_ends_at = now + 7 jours
    ├── plan = null (= 'free')
    │
    ├─── Dans les 7 jours ──▶ TRIAL ACTIF ✅
    │   hasFullAccess = true
    │   Accès complet : IA 70B, patients, tokens WA, dashboard
    │
    └─── Après 7 jours ──────▶ EXPIRÉ ❌
         │
         ├── plan='premium' ET plan_expires_at > now → PREMIUM ✅
         │   hasFullAccess = true · Admin l'a activé via /api/admin/set-plan
         │
         └── sinon → EXPIRÉ ❌
               form.html : patient voit "service indisponible"
               dashboard : bannière + bouton WA upgrade admin
               Cron J+1 : KV trial_expired:{id} + trial_notified=1
               Admin voit : notifications badge dans /admin
```

### Fonction `getTrialStatus(doctor)` → retourne

| Champ | Type | Description |
|-------|------|-------------|
| `isPaidPremium` | bool | `plan='premium'` ET `plan_expires_at` futur |
| `inTrial` | bool | `trial_ends_at` défini ET futur |
| `trialExpired` | bool | `trial_ends_at` passé ET non premium |
| `hasFullAccess` | bool | `isPaidPremium OR inTrial` |
| `daysLeft` | int | Jours restants dans le trial (0 si expiré/premium) |

---

## 9. Routes API — Référence complète

### Publiques (sans authentification)

| Méthode | Route | Fonction | Description |
|---------|-------|----------|-------------|
| POST | `/api/auth/inscription` | `handleInscription` | Crée compte + session + trial 7j |
| POST | `/api/auth/login` | `handleLogin` | Auth + retourne plan/daysLeft |
| POST | `/api/auth/logout` | `handleLogout` | Supprime session KV |
| GET | `/api/doctor-info?slug=` | `handleDoctorInfo` | Info publique médecin (QR poster) |
| GET | `/api/form-config?slug=` | `handleFormConfig` | Config formulaire (canal QR) |
| GET | `/api/form-config?token=` | `handleFormConfig` | Config formulaire (canal WA) |
| POST | `/api/feedback` | `handleFeedback` | Soumission avis + pipeline IA complet |
| POST | `/api/track-google` | `handleTrackGoogle` | Track clic Google Maps → `vers_google=1` |

### Authentifiées médecin (cookie session requis)

| Méthode | Route | Fonction | Description |
|---------|-------|----------|-------------|
| POST | `/api/auth/change-password` | `handleChangePassword` | Changer mot de passe |
| POST | `/api/onboarding` | `handleOnboarding` | Config profil + invalide KV SEO v1+v2 |
| GET | `/api/dashboard` | `handleDashboard` | Stats + trial + 5 derniers avis + WA upgrade |
| GET | `/api/feedbacks` | `handleFeedbacks` | Liste avis (filtres: type, canal, period) |
| GET | `/api/patients` | `handlePatients` | Liste patients (50 max, recherche ?q=) |
| POST | `/api/patients` | `handlePatients` | Ajouter patient (nom + téléphone) |
| POST | `/api/tokens/generate` | `handleGenerateToken` | Génère token 8chars + lien WA + message |
| PUT | `/api/config` | `handleConfig` | Met à jour profil + invalide KV SEO v1+v2 |
| POST | `/api/upgrade` | `handleUpgrade` | Demande upgrade → DB + lien WA admin |

### Super-admin (header X-Admin-Key ou CF-Access email)

| Méthode | Route | Fonction | Description |
|---------|-------|----------|-------------|
| GET | `/api/admin/stats` | `handleAdminStats` | Total doctors, feedbacks, upgrades, expired trials |
| GET | `/api/admin/doctors` | `handleAdminDoctors` | Tous médecins + total_feedbacks |
| GET | `/api/admin/upgrades` | `handleAdminUpgrades` | Demandes upgrade (50 dernières) |
| GET | `/api/admin/notifications` | `handleAdminNotifications` | Médecins trial expiré non convertis |
| POST | `/api/admin/set-plan` | `handleAdminSetPlan` | Active premium + plan_expires_at |
| POST | `/api/admin/toggle-actif` | `handleAdminToggleActif` | Active/désactive compte médecin |
| POST | `/api/admin/upgrade-status` | `handleAdminUpgradeStatus` | Change statut demande upgrade |
| POST | `/api/admin/create-doctor` | `handleAdminCreate` | Crée médecin directement |
| POST | `/api/admin/delete-doctor` | `handleAdminDeleteDoctor` | Supprime médecin + cascade complète |
| GET | `/api/admin/settings` | `handleAdminGetSettings` | Lit admin_wa KV |
| POST | `/api/admin/settings` | `handleAdminSaveSettings` | Sauvegarde admin_wa KV |
| POST | `/api/admin/cron` | `handleAdminCron` | Déclenche manuellement le cron trial |

### Redirections navigation

| Pattern URL | Destination | Description |
|-------------|-------------|-------------|
| `/form/[slug]` | `/form.html?slug=[slug]` | Formulaire patient via QR code |
| `/qr/[slug]` | `/qr.html?slug=[slug]` | Poster QR code imprimable |
| `/r/[TOKEN]` | `/form?token=[TOKEN]` | Lien WhatsApp (valide token KV avant redirect) |
| `/form?token=` | `form.html` (ASSETS.fetch) | Sert form.html pour canal WA |
| `*` (fallback) | `ASSETS.fetch(request)` | Sert les fichiers HTML statiques |

---

## 10. Flux utilisateur complet

### Flux A — Médecin (inscription → utilisation)

```
1. GET /inscription → POST /api/auth/inscription
   ← Crée doctors row (trial_ends_at = now+7j, plan=null)
   ← Crée session KV (7j)
   ← Cookie session={UUID}
   → Redirect /onboarding

2. GET /onboarding → POST /api/onboarding
   Body: { google_maps_url, whatsapp_assistante, chips_positifs,
           template_suggestion, vocabulaire_positif, telephone }
   ← UPDATE doctors SET onboarded=1, ...
   ← DELETE KV doctor_seo_v2:{slug} (invalide cache SEO)
   → Redirect /dashboard

3. GET /dashboard → GET /api/dashboard
   ← { stats:{total,positifs,negatifs,vers_google},
        trial:{in_trial,days_left,trial_expired},
        doctor:{...}, recent:[5 derniers feedbacks],
        upgrade_wa_url }

4. Patients → GET /api/patients
   → POST /api/patients { nom, telephone }
   → POST /api/tokens/generate { patient_id }
   ← { token, link: "/r/TOKEN", wa_url: "wa.me/...", message }
   → Médecin envoie WA manuellement au patient

5. QR Code → GET /qr/{slug}
   ← Génère QR pointant sur /form/{slug}
   → Médecin imprime le poster

6. Modifier profil → PUT /api/config { chips_positifs, google_maps_url, ... }
   ← UPDATE doctors SET ...
   ← DELETE KV doctor_seo_v2:{slug} + doctor_seo:{slug}
   ← Retourne doctor mis à jour
```

### Flux B — Patient via QR Code

```
1. Scan QR → /form/dr-ahmed-benali-casablanca
   → Redirect 302 → /form.html?slug=dr-ahmed-benali-casablanca

2. form.html → GET /api/form-config?slug=dr-ahmed-benali-casablanca
   ← Si trial expiré : { ok:false, blocked:true, blocked_reason:'trial_expired' }
      → Affiche page "service temporairement indisponible"
   ← Si OK : { chips_positifs, template_suggestion, nom, logo_url, ... }
      → Affiche formulaire étoiles + chips + commentaire optionnel

3. Patient soumet → POST /api/feedback
   Body: { slug, note, chips_selected, commentaire, canal:'QR', ab_variante:'B' }
   
   Worker process :
   a. Résout médecin via slug
   b. Double-check trial/plan (sécurité)
   c. Détermine type :
      - note ≥ 4 → POSITIF
      - note ≤ 2 → NEGATIF
      - note = 3 + commentaire → llama-3.1-8b sentiment → POSITIF|NEGATIF
   d. Si POSITIF → generateReviewWithAgent() (pipeline 5 étapes)
   e. calcSeoScore() → seo_score /100
   f. INSERT feedbacks (avec tous les champs SEO)
   g. UPDATE doctors SET avis_ce_mois += 1
   h. Retourne { type:'POSITIF', google_url, suggestion, seo_score, feedback_id }

4. form.html → sessionStorage.setItem('reviewResult', JSON.stringify({...}))
   → Redirect /result

5. result.html → sessionStorage.getItem('reviewResult')
   Si POSITIF :
   - Affiche badge SEO : 🏆 ≥80 "Score SEO : X/100 — Excellent !"
                          ⚡ 60-79 "Score SEO : X/100 — Bon avis"
   - Auto-copy presse-papiers (setTimeout 600ms) → toast "✅ Avis copié !"
   - Guide 3 étapes visuel (copié ✅ → Maps s'ouvre → colle+publie)
   - Bouton "Copier & Publier sur Google Maps"
     → autoCopyAndOpen() → open google_maps_url + POST /api/track-google
   Si NEGATIF :
   - Block WA cabinet : wa.me/{whatsapp_assistante}
```

### Flux C — Patient via WhatsApp Token

```
1. Médecin génère token → /r/aB3kLm9P créé dans TOKENS_KV + DB
   Message WA pré-rédigé envoyé manuellement au patient

2. Patient clique lien /r/aB3kLm9P
   Worker vérifie TOKENS_KV :
   - invalide → redirect /token-error?reason=invalid
   - used=true → redirect /token-error?reason=used
   - expiré → redirect /token-error?reason=expired
   - OK → redirect 302 /form?token=aB3kLm9P

3. GET /form?token= → ASSETS.fetch(form.html)
4. form.html → GET /api/form-config?token=aB3kLm9P
   ← { canal:'WA', ab_variante:'B', nom, chips, ... }

5. POST /api/feedback { token, note, chips, commentaire }
   → patient_id récupéré depuis TOKENS_KV
   → canal = 'WA'
   → Pipeline identique au flux QR
   → TOKENS_KV.put(token, {..., used:true}, TTL:1h)
   → UPDATE tokens SET used=1
```

---

## 11. Authentification & Sécurité

### Session médecin
```javascript
// Cookie : session={UUID}; HttpOnly; SameSite=Lax; Path=/; Max-Age=604800
// KV : session:{UUID} → { doctor_id, expires_at }  TTL: 7 jours
// Validation : getDoctor(env, request) → doctor row ou null
```

### Password hashing
```
Algorithme : PBKDF2 / SHA-256 / 100 000 itérations / sel 16 bytes
Format stocké : "pbkdf2:{saltHex32chars}:{hashHex64chars}"
```

### Auth admin
```javascript
// Méthode 1 : header CF-Access-Authenticated-User-Email === env.ADMIN_EMAIL
// Méthode 2 : header X-Admin-Key === env.ADMIN_SECRET
```

### WhatsApp phone normalizer
```
"0612345678"      → "212612345678"
"00212612345678"  → "212612345678"
URL : https://wa.me/{normalized}?text={encodedMessage}
```

### Slug generator
```
makeSlug("Dr Ahmed Benali", "Casablanca")
→ normalize NFD (enlève accents)
→ lowercase
→ remplace non-alphanumeric par "-"
→ trim "-" debut/fin
→ substring(0, 60)
→ "dr-ahmed-benali-casablanca"
Collision : slug + "-" + uuid.slice(0, 4)
```

---

## 12. Modèles IA — État actuel vs Recommandé

| Rôle | Modèle actuel | N/M input | N/M output | → Recommandé | → N/M input | Gain |
|------|--------------|-----------|------------|--------------|------------|------|
| Génération | `llama-3.3-70b-fp8-fast` | **26 668** | **204 805** | `qwen3-30b-a3b-fp8` | **4 625** | ×5.8 |
| Scorer SEO | `llama-3.1-8b-fp8-fast` | **4 119** | **34 868** | `granite-4.0-h-micro` | **1 542** | ×2.7 |
| Embeddings | `bge-m3` | 1 075 | — | *(conserver)* | 1 075 | — |

**Économie totale estimée : ×5.5 de réduction des neurons (de ~47 à ~8.5 N/avis)**

---

## 13. État production (05/05/2026)

| Métrique | Valeur |
|----------|--------|
| Médecins inscrits | ~8 |
| Total feedbacks | ~41 |
| Dernier commit | `e84072f` |
| Dernier déploiement | 05/05/2026 ~10h15 |
| Build | Direct upload `wrangler pages deploy` |

### Médecins de test actifs

| Slug | Médecin | Spécialité | Ville | Plan |
|------|---------|------------|-------|------|
| `dr-el-akhdari-meriem-sale` | Dr El Akhdari Meriem | Ophtalmologue | Salé | trial |
| `dr-aloun-casablanca` | Dr Aloun | — | Casablanca | trial |
| *(+6 autres)* | — | — | — | trial |

Google Maps URL configurée (tous les médecins test) :  
`https://g.page/r/CWxgHd-6r--LEBM/review`

---

## 14. Bugs connus

| # | Priorité | Sujet | Détail |
|---|----------|-------|--------|

| 2 | 🟡 Cache | **KV v1 legacy** | `doctor_seo:{slug}` (v1) non supprimé dans `handleAdminDeleteDoctor` |
| 3 | 🟡 Infra | **Cron à activer** | Trigger `0 8 * * *` à configurer dans CF Pages → Settings → Functions → Cron Triggers |
| 4 | 🟡 DevOps | **Pas de CI/CD** | Déploiement manuel `wrangler pages deploy` requis après chaque `git push` |
| 5 | 🟢 Info | **Token wrangler** | `cfut_xxxx...` Pages:Edit — stocker dans variable d'env ou secret |
| 6 | 🟢 Info | **Cache wrangler** | `.wrangler/cache/pages.json` → account_id = `cb2ae19b37f0f121153a05739e2a8698` |

---

## 15. Commandes utiles

```bash
# ── Déployer en production
cd C:\Users\OALI\Desktop\ReviewPro
CLOUDFLARE_API_TOKEN="<votre-token-cloudflare>" \
  npx wrangler pages deploy . --project-name reviewpro-saas --commit-dirty=true

# ── Git + déploiement complet
git add _worker.js *.html
git commit -m "feat: ..."
git push origin main
# puis wrangler pages deploy ci-dessus

# ── Requêtes D1 (via wrangler avec token full-access)
npx wrangler d1 execute reviewpro-db --remote \
  --command "SELECT slug, nom, plan, trial_ends_at FROM doctors"

# ── Vider cache SEO KV d'un médecin
npx wrangler kv key delete "doctor_seo_v2:dr-ahmed-benali-casablanca" \
  --namespace-id 95e35348173a448e8293f4bcdff87d7d --remote

# ── Tester le cron manuellement
curl -X POST https://reviewpro-saas.pages.dev/api/admin/cron \
  -H "X-Admin-Key: {ADMIN_SECRET}"
```
