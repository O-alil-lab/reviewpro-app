# ReviewPro — Documentation Frontend

## Vue d'ensemble

Le frontend est constitué de pages HTML/CSS/JS statiques servies par Cloudflare Pages. Pas de framework (React, Vue…) — chaque page est autonome et communique avec le Worker via `fetch()`. Le style est homogène grâce à des variables CSS partagées et une charte graphique cohérente.

---

## Charte graphique

```css
/* Couleurs principales */
--primary: #0d9488;      /* Teal — boutons, liens, accents */
--primary-dark: #0f766e; /* Hover état */
--danger: #ef4444;       /* Avis négatifs, alertes */
--success: #10b981;      /* Avis positifs, validations */
--warning: #f59e0b;      /* Avertissements trial */
--bg: #f0fafa;           /* Fond général */
--card: #ffffff;         /* Cartes et panneaux */
--text: #1e293b;         /* Texte principal */
--muted: #64748b;        /* Texte secondaire */

/* Typographie */
Font: Inter (Google Fonts)
Titre h1: 1.5rem / 600
Corps: 0.875rem–1rem / 400

/* Composants */
border-radius cards: 1rem
border-radius boutons: 0.5rem
box-shadow: 0 1px 3px rgba(0,0,0,0.08)
```

---

## Structure des pages

```
ReviewPro/
├── index.html          — Landing page publique (marketing)
├── login.html          — Connexion médecin
├── inscription.html    — Créer un compte (trial 7 jours)
├── onboarding.html     — Configuration initiale après inscription
├── dashboard.html      — Tableau de bord principal médecin
├── form.html           — Formulaire patient (collecte d'avis)
├── result.html         — Page résultat après soumission avis
├── qr.html             — Générateur QR code médecin
├── admin.html          — Panel super-admin
├── token-error.html    — Erreur token (invalide/expiré/utilisé)
└── logo.svg            — Logo ReviewPro
```

---

## Page par page

### `index.html` — Landing page

**Rôle** : Présenter la plateforme aux médecins et les inciter à s'inscrire.

**Sections** :
1. Hero — Titre, sous-titre, CTA "Essai gratuit 7 jours"
2. Problème/Solution — Ce que ReviewPro résout
3. Fonctionnalités — 3 blocs (collecte, IA, tableau de bord)
4. Plans & tarifs — Starter / Essentiel / Avancé
5. Footer

**Liens** : `→ /inscription` (CTA), `→ /login` (se connecter)

---

### `login.html` — Connexion

**Flux** :
```
Saisie email + mdp
→ POST /api/auth/login
  ✓ ok + onboarded=1  → redirect /dashboard
  ✓ ok + onboarded=0  → redirect /onboarding
  ✗ erreur            → Message d'erreur inline
```

**Éléments clés** :
- Champ email + champ mot de passe (toggle afficher/masquer)
- Bouton "Se connecter" avec spinner de chargement
- Lien "Créer un compte médecin" → `/inscription`

---

### `inscription.html` — Création de compte

**Flux** :
```
Formulaire : nom, spécialité, ville, email, téléphone, mot de passe
→ POST /api/auth/inscription
  ✓ 201 → redirect /onboarding (session créée automatiquement)
  ✗ 409 → "Email déjà utilisé"
  ✗ 400 → Erreur de validation
```

**Validation côté client** :
- Mot de passe minimum 8 caractères
- Email format valide
- Tous les champs obligatoires

---

### `onboarding.html` — Configuration initiale

**Rôle** : Compléter le profil médecin lors de la première connexion.

**Étapes** (5 sections) :
1. **Lien Google Maps** — URL de la fiche Google My Business
2. **WhatsApp assistante** — Numéro pour recevoir les alertes
3. **Chips positives** — Tags sélectionnables par les patients (ex: Accueil, Propreté…)
4. **Template suggestion** — Modèle de suggestion Google avec `{nom}`, `{specialite}`, `{ville}`
5. **Vocabulaire positif** — Mots-clés SEO supplémentaires

**Flux** :
```
Remplissage formulaire multi-étapes
→ POST /api/onboarding
  ✓ → redirect /dashboard
```

---

### `dashboard.html` — Tableau de bord principal ⭐

**Rôle** : Centre névralgique du médecin. Affiche les stats, les avis, les patients et la config.

#### Navigation (bottom tabs mobile)
- 🏠 Accueil — Statistiques
- 📋 Retours — Historique des avis
- 👤 Patients — Liste et envoi de tokens
- ⚙️ Config — Paramètres du compte
- 📊 Plan — Quota et upgrade

#### Section Accueil — Statistiques
Appel : `GET /api/dashboard`

Cartes affichées :
| Métrique | Description |
|----------|-------------|
| Retours reçus | Total avis ce mois |
| Taux positif | % avis positifs |
| Note moyenne | Moyenne des notes /5 |
| Publiés Google | Avis redirigés Google |
| Score SEO moyen | Moyenne des scores /100 |

Graphique d'activité : barres des 30 derniers jours.

#### Section Retours — Avis patients
Appel : `GET /api/feedbacks?limit=100`

Fonctionnalités :
- Filtres : type (POSITIF/NEGATIF), statut (traité/non traité)
- Badge couleur : vert (positif), rouge (négatif)
- Clic sur un avis → modal détail (suggestion IA, chips sélectionnés, canal)
- Bouton "Marquer traité" → `PATCH /api/feedbacks/{id}/traite`

#### Section Patients — Gestion patients
Appel : `GET /api/patients`

Fonctionnalités :
- Recherche par nom ou téléphone
- Ajouter un patient (POST /api/patients)
- Bouton "Envoyer lien" → génère token (POST /api/tokens/generate) + ouvre WhatsApp

#### Section Config — Paramètres
Appel : `GET /api/config`

Champs modifiables :
- Nom, spécialité, ville, téléphone
- Logo URL, lien Google Maps, WhatsApp assistante
- Chips positifs (drag-and-drop pour réordonner)
- Template suggestion + vocabulaire positif
- Langue par défaut (fr/ar/darija)

Sauvegarde : `PUT /api/config`

#### Section Plan — Abonnement
Appel : `GET /api/me`

Affiche :
- Plan actuel + quota restant (barre de progression)
- Statut trial (jours restants)
- Tableau comparatif des plans
- Bouton "Upgrade" → `POST /api/upgrade-request` puis contact WhatsApp admin

#### Notifications (cloche)
Appel : `GET /api/notifications`

Badge rouge sur la cloche si avis négatifs non traités. Liste déroulante avec aperçu.

#### Nouveau QR (bouton header)
Redirige vers `/qr` pour générer un QR code de collecte publique.

---

### `form.html` — Formulaire patient ⭐

**Rôle** : Interface patient pour laisser un avis. Accessible via `/form?token={TOKEN}` ou `/form?slug={SLUG}`.

#### Étapes du formulaire

**Étape 1 — Note étoiles**
- 5 étoiles cliquables (animation)
- Couleur adaptative : rouge (1-2), orange (3), vert (4-5)

**Étape 2 — Chips de feedback**
- Tags positifs du médecin affichés comme boutons sélectionnables
- Multi-sélection possible

**Étape 3 — Commentaire (optionnel)**
- Textarea avec compteur de caractères
- Template de suggestion pré-rempli si note ≥ 4
- Support multilingue (fr/ar/darija selon `langue_defaut`)

**Soumission** :
```
POST /api/feedback {slug, token, note, commentaire, chips_selected, canal}
→ redirect /result?token= ou /result?slug=
```

#### Gestion des états
- **Token invalide** : redirect `/token-error?reason=invalid`
- **Token déjà utilisé** : redirect `/token-error?reason=used`
- **Token expiré** : redirect `/token-error?reason=expired`
- **Compte bloqué** : message "Service temporairement indisponible"

---

### `result.html` — Page résultat

**Rôle** : Affichée après soumission d'un avis. Encourage à publier sur Google.

**Pour un avis POSITIF** :
1. Animation de succès (confetti ou check animé)
2. Suggestion Google générée par l'IA (copiable en 1 clic)
3. Guide 3 étapes : "Copier → Ouvrir Google → Coller"
4. Bouton "Publier sur Google" → ouvre Google Maps du médecin

**Pour un avis NÉGATIF** :
1. Message de remerciement discret
2. Bouton WhatsApp assistante pour signaler le problème
3. Pas de redirection Google

**Tracking** :
- Clic "Publier sur Google" → `POST /api/track-google` → incrément `vers_google`

---

### `qr.html` — Générateur QR

**Rôle** : Générer un QR code public que le médecin peut imprimer/afficher en salle d'attente.

**Fonctionnement** :
- Génère un QR code pointant vers `/form?slug={SLUG}` (sans token, sans patient)
- Les patients peuvent scanner sans avoir reçu de lien WhatsApp
- Le formulaire fonctionne en mode QR (canal = 'QR', pas de patient_id)

**Options** :
- Télécharger en PNG
- Aperçu du lien

---

### `admin.html` — Panel super-admin

**Accès** : Protégé par mot de passe (`X-Admin-Key: {ADMIN_SECRET}`)

**Sections** :

| Section | Endpoint | Action |
|---------|----------|--------|
| Statistiques globales | GET /api/admin/stats | Médecins, avis, trials |
| Liste médecins | GET /api/admin/doctors | Paginator, recherche |
| Créer médecin | POST /api/admin/create-doctor | Formulaire complet |
| Modifier plan | POST /api/admin/set-plan | Changer plan + expiry |
| Supprimer médecin | POST /api/admin/delete-doctor | Cascade delete |
| Demandes upgrade | GET /api/admin/upgrade-requests | Approuver/refuser |

**Stats affichées** :
- Total médecins actifs
- Total avis collectés
- Trials actifs / expirés
- Répartition par plan

---

### `token-error.html` — Erreur token

**Paramètre URL** : `?reason=invalid|used|expired`

Messages affichés :
- `invalid` → "Ce lien n'existe pas ou a été révoqué"
- `used` → "Cet avis a déjà été soumis via ce lien"
- `expired` → "Ce lien a expiré (validité 48h)"

---

## Patterns JavaScript communs

### Appel API authentifié

```javascript
const res = await fetch('/api/endpoint', {
  method: 'POST',
  credentials: 'include',          // Envoie le cookie de session
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(payload)
});
const data = await res.json();
if (!data.ok) showError(data.error);
```

### Vérification session au chargement

```javascript
// Au chargement de chaque page protégée
const me = await fetch('/api/me', { credentials: 'include' }).then(r => r.json());
if (!me.ok) window.location.href = '/login';
```

### Gestion du plan (blocage trial expiré)

```javascript
// Dans le dashboard, vérification hasFullAccess
if (!me.doctor.trial_status.has_full_access) {
  showUpgradeBanner();
  disablePatientActions();
}
```

### Quota mensuel

```javascript
// Barre de progression dans la section Plan
const pct = Math.min((doctor.avis_ce_mois / doctor.quota) * 100, 100);
quotaBar.style.width = pct + '%';
quotaLabel.textContent = `${doctor.avis_ce_mois} / ${doctor.quota} avis ce mois`;
```

---

## Fichiers de configuration

### `_redirects`

```
/login     /login.html    200
/dashboard /dashboard.html 200
/form      /form.html     200
...
```

### `_headers`

Headers de sécurité appliqués à toutes les pages :
- `X-Frame-Options: DENY`
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: strict-origin-when-cross-origin`

### `wrangler.jsonc`

Configuration Cloudflare : bindings D1, KV, AI, date de compatibilité.

---

## Flux complets end-to-end

### Nouveau médecin

```
1. /inscription   → Saisie infos + mot de passe
2. /onboarding    → Config (Google Maps, WhatsApp, chips, template)
3. /dashboard     → Tableau de bord vide, guide "premier pas"
4. /qr ou Patients → Commencer à collecter des avis
```

### Collecte d'avis via WhatsApp

```
1. Dashboard > Patients > "Ajouter patient" (nom + tel)
2. Clic "Envoyer lien" → ouvre WhatsApp avec message pré-rédigé + lien /r/TOKEN
3. Patient reçoit → clique lien → formulaire form.html
4. Patient note + chips + commentaire → soumission
5. IA génère suggestion → result.html avec bouton Google
6. Dashboard médecin → nouvel avis visible en temps réel
```

### Collecte d'avis via QR (salle d'attente)

```
1. Médecin imprime QR depuis /qr
2. Patient scanne → /form?slug=dr-meriem-casablanca
3. Même formulaire, sans patient_id (canal = 'QR')
4. Avis soumis → dashboard
```

---

## Support multilingue

La langue est définie par `langue_defaut` dans le profil médecin (`fr`, `ar`, `darija`).

Le formulaire (`form.html`) adapte :
- Le placeholder du commentaire
- Les labels des étapes
- La direction du texte (`dir="rtl"` pour l'arabe)

Les suggestions IA sont générées dans la langue du médecin via le prompt système.
