# ReviewPro SaaS — Design Brief complet pour wireframe
> À donner tel quel à Claude Design / Figma AI / tout outil de wireframing

---

## 1. CONTEXTE PRODUIT

**ReviewPro** est un SaaS B2B ciblant les **médecins marocains**.
Il automatise la collecte d'avis patients via QR code ou WhatsApp,
enrichit chaque avis avec un **agent IA (Llama 3.3 70B)** pour le SEO local Google Maps,
et affiche tout dans un dashboard médecin.

**URL live :** https://reviewpro-saas.pages.dev
**Stack :** Cloudflare Pages + D1 + Workers AI — aucun serveur backend.
**Langue UI :** Français (Maroc)
**Couleurs actuelles :**
- Primaire : `#2563eb` (bleu)
- Secondaire : `#7c3aed` (violet)
- Dark bg : `#0f172a`
- Texte : `#0f172a`
- Gris clair : `#f1f5f9`, `#e2e8f0`
- Succès : `#059669`
- Danger : `#dc2626`
- Warning : `#d97706`

---

## 2. ARCHITECTURE DES PAGES

```
/ ...................... Landing page (publique)
/dashboard.html ........ Dashboard médecin (authentifié)
/form/[slug] ........... Formulaire patient (public, mobile-first)
/result ................ Page résultat après soumission patient
/admin.html ............ Super Admin panel (protégé)
/login ................. Connexion médecin (non encore créée — à designer)
/register .............. Inscription médecin (non encore créée — à designer)
```

---

## 3. PAGE 1 — LANDING PAGE (`/`)

### Layout général
- **Navbar** fixe, fond blanc, ombre légère
  - Logo gauche : ⭐ ReviewPro
  - Liens centre : Fonctionnalités | Tarifs | Comment ça marche | Connexion
  - CTA droite : bouton "🎁 Essai 7 jours" (bleu gradient)

- **Bannière top** : bandeau vert plein largeur sous la navbar
  - Texte : "7 jours d'essai Premium gratuit — Agent IA inclus, sans carte bancaire"
  - Bouton ghost : "Commencer maintenant →"

### Sections (dans l'ordre)

#### A. Hero
- **Badge** : "🇲🇦 Conçu pour les médecins marocains"
- **Titre H1** (grand, gras) :
  ```
  Plus d'avis Google,
  propulsés par l'IA.
  ```
  Mot "IA" en gradient bleu→violet
- **Sous-titre** : "ReviewPro collecte les avis de vos patients par QR code et WhatsApp.
  Notre agent IA (Llama 70B) enrichit chaque avis avec vos mots-clés SEO locaux —
  pour dominer Google Maps dans votre ville."
- **CTA primaire** : "Démarrer l'essai gratuit →" (bleu)
- **CTA secondaire** : "Comment ça marche" (outline gris)
- **Trust line** : "✅ 7 jours Premium offerts · Sans carte bancaire · Sans engagement"
- **Mockup téléphone** (droite) :
  - Carte médecin avec avatar initiales
  - Étoiles jaunes (4/5)
  - Chips sélectionnés : "Accueil ✓", "Écoute ✓", "Explications ✓"
  - Box verte : "🤖 Agent IA — Avis enrichi SEO" + extrait de texte généré
  - Bouton "Publier sur Google Maps →"

#### B. Features Grid (3 colonnes)
Titre section : **"Tout ce qu'il faut pour dominer Google Maps"**

| Card | Emoji | Badge | Description |
|---|---|---|---|
| Agent IA 3 étapes | 🤖 | NOUVEAU (vert) | Llama 3.3 70B génère l'avis, scorer 8B valide, bge-m3 anti-hallucination |
| SEO local par médecin | 🎯 | NOUVEAU (vert) | Chaque avis intègre automatiquement spécialité + ville + nom médecin |
| QR Code & WhatsApp | 📱 | — | QR à imprimer en salle d'attente + lien WhatsApp personnalisé |
| Collecte automatique | ⚡ | — | Patient scanne, note, valide → avis enrichi prêt en 15 secondes |
| Dashboard Analytics | 📊 | — | Stats temps réel : avis positifs, négatifs, clics Google Maps |
| Gestion patients | 👥 | — | Carnet patients + envoi token WhatsApp individuel |

#### C. Pipeline IA (section sombre, fond `#0f172a`)
Titre : **"L'agent qui contrôle chaque avis"**
Sous-titre : "Un pipeline en 3 étapes garantit que chaque avis est excellent, fidèle à l'expérience du patient, et optimisé pour le SEO local."

3 cartes avec flèches entre elles :
```
[Llama 3.3 70B]         [Llama 3.1 8B]         [bge-m3 embeddings]
Génération SEO    →     Score qualité     →     Anti-hallucination
✏️                       🔍                       🧬
"Rédige un avis          "Note le texte:          "Cosine similarity
enrichi 80-150 mots"     si score <72,            entre input patient
                         retry avec lacunes"      et avis généré.
                                                  Rejet si <0.28"
```
Badges colorés : `[Llama 3.3 70B]` bleu / `[Llama 3.1 8B]` vert / `[bge-m3 embeddings]` rouge

#### D. Stats de confiance (4 chiffres)
Fond blanc, 4 colonnes :
- **70B** params — Modèle de génération
- **3** étapes — Contrôle qualité
- **0** hallucinations — Sécurité médicale
- **7j** d'essai — Sans carte bancaire

#### E. Comment ça marche (3 étapes)
Titre : **"En 3 étapes, vos patients vous laissent des avis parfaits"**

```
Étape 1               Étape 2               Étape 3
[QR Code icon]    →   [Étoiles icon]    →   [Google icon]
Le patient          Il note sa visite       L'avis enrichi
scanne le QR        et sélectionne          par l'IA est prêt
de votre cabinet    ses points positifs     à publier en 1 clic
(Essai 7j activé
automatiquement)
```

#### F. Pricing (2 cartes)

**Carte 1 — Essai Gratuit** (outline, fond blanc)
```
ESSAI GRATUIT
0  MAD / 7 jours
[✅ Accès complet Premium]

✓ Agent IA Llama 70B inclus
✓ Avis illimités pendant 7 jours
✓ QR Code + WhatsApp
✓ Dashboard Analytics
✓ Score SEO 100/100
✓ Sans carte bancaire
```
CTA : "Commencer l'essai gratuit →"

**Carte 2 — Premium** (fond sombre #0f172a, badge "⭐ APRÈS L'ESSAI")
```
PREMIUM
199  MAD/mois

✓ Agent IA 3 étapes (70B + 8B + bge-m3)
✓ Avis illimités
✓ SEO local personnalisé par médecin
✓ Gestion patients + tokens WhatsApp
✓ Analytics avancées
✓ Support WhatsApp prioritaire
```
CTA : "Activer Premium" (bleu gradient)

#### G. CTA Final
Fond gradient bleu→violet, centré :
- Titre : "Prêt à dominer Google Maps dans votre ville ?"
- Sous-titre : "🎁 7 jours d'essai Premium gratuit — Agent IA Llama 70B inclus"
- Bouton blanc : "Démarrer gratuitement →"
- Texte : "Sans carte bancaire · Sans engagement · Activation immédiate"

#### H. Footer
3 colonnes + copyright :
- Col 1 : Logo + tagline
- Col 2 : Produit (Fonctionnalités, Tarifs, Comment ça marche)
- Col 3 : Contact (WhatsApp, Email)
- Bottom : © 2026 ReviewPro · Tous droits réservés

---

## 4. PAGE 2 — FORMULAIRE PATIENT (`/form/[slug]`)

### Contexte
- **Mobile-first** (affiché sur téléphone après scan QR)
- Centré verticalement sur fond gradient dark (`#0f172a → #1e3a5f → #312e81`)
- Card blanche max-width 440px, border-radius 24px, shadow forte

### Structure de la card

#### Header card (fond sombre dégradé)
- Avatar médecin : initiales 2 lettres, cercle 72px, gradient bleu→violet
  (ou photo si logo_url défini)
- Nom médecin (blanc, 18px bold)
- Sous-titre : "Spécialité · Ville" (gris, 13px)

#### Body card — 3 étapes avec progress bar

**Progress bar** :
- 3 segments horizontaux (fond gris → bleu actif → violet)
- Label : "Étape X sur 3"
- Animation fade-in à chaque changement d'étape

---

**Étape 1 — Note (⭐ Stars)**
- Titre : "Comment s'est passée votre visite ?"
- 5 étoiles cliquables, taille 44px
  - Désactivées : grises, opacité 0.4
  - Actives : jaunes (🌟), scale 1.1
  - Hover : scale 1.2
- Label dynamique sous les étoiles :
  - 1★ : "😞 Mauvais"
  - 2★ : "😐 Passable"
  - 3★ : "😊 Bien"
  - 4★ : "😃 Très bien"
  - 5★ : "🤩 Excellent !"
- Auto-avance vers Étape 2 après 350ms

---

**Étape 2 — Chips qualité**
- Titre : "Qu'avez-vous apprécié ?"
- Sous-titre : "Sélectionnez un ou plusieurs points"
- Chips : pill-buttons wrap (padding 8px 16px, border-radius 20px)
  - Non sélectionné : fond `#f8fafc`, bordure `#e2e8f0`, texte `#374151`
  - Sélectionné : fond `#eff6ff`, bordure `#2563eb`, texte `#1d4ed8`, bold
  - Chips par défaut : Accueil / Écoute / Explications / Professionnalisme / Propreté / Temps d'attente
- Bouton "Continuer →" (bleu, full width)
- Bouton "← Retour" (gris clair)

---

**Étape 3 — Commentaire**
- Titre : "Partagez votre expérience"
- Sous-titre : "En quelques mots, décrivez votre visite"
- **Suggestion IA** (si disponible) :
  - Label : "✨ Suggestion (cliquez pour l'utiliser)"
  - Box gris clair cliquable → remplit le textarea
  - Hover : bordure bleue
- **Textarea** : min-height 100px, max 500 caractères
  - Focus : bordure bleue + glow subtil
  - Compteur caractères bas droite
- Bouton "Envoyer mon avis" (bleu, full width, disabled pendant envoi)
  - État chargement : spinner + "Envoi…"
- Bouton "Passer (sans commentaire)" (text, gris)
- Bouton "← Retour" (gris clair)

---

**États spéciaux :**

- **Chargement** : spinner centré + "Chargement…"
- **Erreur** : card rouge pale, icône ⚠️ + message
- **Bloqué (trial expiré)** :
  - Icône 🔒 (64px)
  - "Cabinet temporairement indisponible"
  - Header grisé opacity 0.6

---

## 5. PAGE 3 — RÉSULTAT PATIENT (`/result`)

### Cas POSITIF (note 4-5★)
- Fond vert dégradé
- Icône ✅ animée (bounce)
- Titre : "Merci pour votre avis !"
- Avis enrichi IA dans une box copiable (textarea readonly)
- Bouton copier dans presse-papier
- Bouton "Publier sur Google Maps →" (vert, ouvre google_maps_url)
- Note de bas : "Votre avis aide d'autres patients à trouver un bon médecin"

### Cas NÉGATIF (note 1-3★ négatif)
- Fond orange/amber dégradé
- Icône 💬
- Titre : "Nous sommes désolés pour votre expérience"
- Texte : "Partagez vos remarques directement avec le cabinet pour qu'il puisse s'améliorer"
- Bouton WhatsApp vert : "💬 Contacter le cabinet"
  (ouvre wa.me/[numero]?text=Bonjour...)

---

## 6. PAGE 4 — DASHBOARD MÉDECIN (`/dashboard.html`)

### Layout global
- **Sidebar fixe gauche** (220px, fond `#0f172a`)
- **Main content** (flex-grow, fond `#f1f5f9`, padding 24px)

### Sidebar
```
┌─────────────────────┐
│ ⭐ ReviewPro         │  ← Logo
├─────────────────────┤
│ [Badge plan]        │  ← "🎁 Essai Premium" / "⭐ Premium" / "🔒 Expiré"
│ "7 jours restants"  │
├─────────────────────┤
│ NAVIGATION          │
│ 📊 Aperçu           │  ← nav-item (active = bordure gauche bleue)
│ 📋 Avis             │
│ 👥 Patients         │
│ ⚙️ Paramètres       │
│ 🚀 Premium          │
├─────────────────────┤
│ [Avatar] Dr. Nom    │  ← initiales en cercle gradient
│ Spécialité · Ville  │
│ [Déconnexion]       │
└─────────────────────┘
```

### Bannière Trial (sous la topbar)
3 états selon le plan :

| État | Couleur | Icône | Message |
|---|---|---|---|
| En essai (>2j) | Bleu clair | 🎁 | "Essai Premium — X jours restants · Activez Premium pour continuer après" |
| Essai urgent (≤2j) | Orange | ⏰ | "Plus que X jour(s) d'essai · Activez maintenant" |
| Expiré | Rouge | 🔒 | "Votre essai a expiré · Le formulaire est suspendu" |
| Premium | — | hidden | (invisible) |

Chaque bannière a un bouton "💬 Activer Premium" (WhatsApp) à droite.

---

### Onglet : Aperçu (Dashboard principal)

**Topbar** :
- Titre "Bonjour, Dr. [Nom]"
- Sous-titre "[Spécialité], [Ville]"

**Barre de quota** :
- Titre "Avis ce mois" + compteur "X / 30" (ou "∞ illimité")
- Barre de progression (bleu → rouge si >80%)
- CTA upgrade si quota ≥ 24/30

**4 Stat Cards** (grid 4 colonnes, fond blanc, border-radius 14px) :
```
[Total avis]    [Avis positifs]   [Avis négatifs]   [Vers Google]
   32               28               4                  19
   bleu             vert             rouge              orange
```

**Card "Lien de collecte"** :
- URL cliquable : `https://reviewpro-saas.pages.dev/form/[slug]`
- Boutons : "📋 Copier" | "🔗 QR Code" | "🔁 Nouveau lien"

**Table "Derniers avis"** (5 entrées) :
| Note | Type | Chips | Avis IA (extrait) | Score SEO | Date |
|---|---|---|---|---|---|
| ⭐⭐⭐⭐⭐ | ✅ POSITIF | Accueil, Écoute | "J'ai eu la chance..." | 100/100 | il y a 2h |
| ⭐⭐ | ❌ NÉGATIF | — | (WA redirect) | — | hier |

---

### Onglet : Avis (Liste complète)

**Filtres** : Tous | Positifs | Négatifs · Filtre période : 7j / 30j / Tout

**Table enrichie** :
| Note | Canal | Avis IA complet | Score SEO | Date | Copier |
|---|---|---|---|---|---|
| ⭐⭐⭐⭐⭐ | QR | "J'ai eu la chance de consulter..." | 🟢 100 | — | 📋 |

---

### Onglet : Patients

**Bouton** : "+ Ajouter un patient"

**Modal "Ajouter patient"** :
- Nom patient (input)
- Téléphone WhatsApp (input)
- Bouton "Ajouter et envoyer token"

**Table patients** :
| Nom | Téléphone | Date ajout | Token WhatsApp | Actions |
|---|---|---|---|---|
| Mohamed A. | +212600... | 04/05/2026 | [Envoyer lien] | ❌ |

---

### Onglet : Paramètres

Formulaire en sections :

**Profil cabinet**
- Logo URL (input)
- URL Google Maps (input, obligatoire)
- Téléphone cabinet (input)
- WhatsApp assistante (input)

**Personnalisation formulaire**
- Chips positifs (tags éditables, max 8)
- Template suggestion (textarea avec variables `{nom}`, `{specialite}`, `{ville}`)
- Langue par défaut (select : Français | Arabe | Mixte)
- Vocabulaire SEO (tags éditables)

**Sécurité**
- Changer mot de passe

---

### Onglet : Premium (Upgrade)

2 cartes côte à côte :

**Gratuit** (outline)
- 0 MAD/mois
- ✅ 30 avis/mois, Formulaire QR/WA, Redirection Google, Stats
- ❌ IA enrichissement, Patients/tokens, Avis illimités
- Badge "Plan actuel" (gris)

**Premium** (dark gradient) + badge "RECOMMANDÉ" (doré)
- 199 MAD/mois
- ✅ Tout illimité + IA + Patients + Analytics
- CTA : "Passer Premium — 199 MAD/mois"
- Note : "Paiement via WhatsApp · Activation immédiate"

---

## 7. PAGE 5 — SUPER ADMIN (`/admin.html`)

> Accessible uniquement par email admin + secret key

### Layout : Sidebar + Main (même structure que dashboard)

### Sidebar Admin
```
🛡️ Super Admin
───────────────
📊 Statistiques
👨‍⚕️ Médecins
🔔 Notifications
⚙️ Paramètres
```

### Onglet : Statistiques
4 KPI cards :
- Total médecins actifs
- Avis collectés (total)
- Taux positif (%)
- Conversions Google Maps

### Onglet : Médecins
Table :
| Médecin | Spécialité | Ville | Plan | Trial | Avis/mois | Actions |
|---|---|---|---|---|---|---|
| Dr Sara Bennani | Dermatologue | Rabat | 🎁 Trial (7j) | Actif | 12 | [▶ Premium] [⏸ Désactiver] |
| Dr Mehdi Fassi | Rhumatologue | Tanger | 🔒 Expiré | — | 3 | [▶ Premium] [🗑 Supprimer] |

Bouton **"+ Créer un médecin"** (admin peut créer un compte manuellement)

### Onglet : Notifications
Cards d'alerte pour chaque trial expiré :
```
🔔 Dr El akhdari Meriem — Ophtalmologue, Salé
   Trial expiré le 11/05/2026
   📧 elakhdari@test.ma  📱 +212...
   [💬 Contacter WhatsApp] [▶ Activer Premium]
```

---

## 8. PAGES MANQUANTES À CRÉER

### PAGE 6 — LOGIN (`/login`)
- Fond dark gradient (même que form.html)
- Card blanche centrée (max-width 400px)
- Logo ReviewPro en header card
- Formulaire :
  - Email (input)
  - Mot de passe (input password + eye toggle)
  - Bouton "Se connecter" (bleu, full width)
  - Lien "Pas encore inscrit ? Créer un compte"
- Gestion erreur inline (fond rouge pale)

### PAGE 7 — REGISTER (`/register`)
- Même style que login
- Formulaire multi-champs :
  - Nom complet (ex: "Dr Sara Bennani")
  - Spécialité (input text ou select commun)
  - Ville (input text)
  - Email
  - Téléphone
  - Mot de passe (avec règles : 8 car min)
- Bouton "Créer mon compte gratuit"
- Lien "Déjà inscrit ? Se connecter"
- Note : "🎁 7 jours Premium activés automatiquement"

### PAGE 8 — ONBOARDING (`/onboarding`) ← post-inscription
Wizard 3 étapes (pas encore existant) :

**Étape 1 — Cabinet**
- URL Google Maps (champ principal, obligatoire)
- Téléphone WhatsApp
- Logo URL (optionnel)

**Étape 2 — Personnalisation IA**
- Chips positifs (6 tags par défaut, éditables)
- Vocabulaire SEO
- Template suggestion (pré-rempli)

**Étape 3 — QR Code**
- Affichage du QR code prêt à imprimer
- Lien de partage
- CTA : "Aller au dashboard"

---

## 9. COMPOSANTS RÉUTILISABLES

### Boutons
| Variante | Fond | Usage |
|---|---|---|
| Primary | Gradient `#2563eb → #1d4ed8` | Actions principales |
| Secondary | Outline `#e2e8f0` | Actions secondaires |
| Danger | `#dc2626` | Suppression |
| WhatsApp | `#25D366` | Actions WhatsApp |
| Ghost | Transparent | Liens tertiaires |

### Badges / Pills
| Label | Couleur | Usage |
|---|---|---|
| NOUVEAU | Vert `#059669` | Features récentes |
| PREMIUM | Doré `#fbbf24` | Plan premium |
| Trial | Bleu `#2563eb` | Essai en cours |
| Expiré | Rouge `#dc2626` | Trial expiré |

### Cards
- Fond blanc, border-radius 14px, shadow `0 1px 3px rgba(0,0,0,.08)`
- Padding 20px
- Titre 15px bold + sous-titre 12px gris

### States
- **Empty state** : icône 📭 + texte centré gris
- **Loading** : spinner bleu centré
- **Error** : fond `#fef2f2`, bordure rouge, texte `#dc2626`
- **Success** : fond `#ecfdf5`, bordure verte, texte `#059669`

---

## 10. DESIGN TOKENS

```css
/* Colors */
--primary: #2563eb;
--primary-dark: #1d4ed8;
--secondary: #7c3aed;
--dark: #0f172a;
--dark-2: #1e293b;
--dark-3: #334155;
--gray-100: #f1f5f9;
--gray-200: #e2e8f0;
--gray-400: #94a3b8;
--gray-600: #475569;
--gray-800: #1e293b;
--success: #059669;
--danger: #dc2626;
--warning: #d97706;
--whatsapp: #25D366;

/* Typography */
--font: 'Segoe UI', system-ui, sans-serif;
--text-xs: 11px;
--text-sm: 13px;
--text-base: 14px;
--text-lg: 17px;
--text-xl: 22px;
--text-2xl: 32px;

/* Radius */
--radius-sm: 8px;
--radius-md: 12px;
--radius-lg: 16px;
--radius-xl: 24px;
--radius-full: 9999px;

/* Shadows */
--shadow-sm: 0 1px 3px rgba(0,0,0,.08);
--shadow-md: 0 4px 16px rgba(0,0,0,.12);
--shadow-lg: 0 30px 80px rgba(0,0,0,.4);
```

---

## 11. RESPONSIVE & BREAKPOINTS

| Breakpoint | Layout |
|---|---|
| Mobile (< 640px) | Formulaire patient plein écran, dashboard en vue liste |
| Tablet (640-1024px) | Dashboard : sidebar cachée (hamburger), grid 2 colonnes |
| Desktop (> 1024px) | Layout complet sidebar + main |

**Priority mobile :** form.html est la page la plus visitée (patients sur téléphone).
Tout le reste (dashboard, admin) peut être desktop-first.

---

## 12. FLUX UTILISATEUR COMPLETS

### Flux A — Nouveau médecin (inscription → collecte)
```
Landing →  Register →  Onboarding (3 étapes)  →  Dashboard
  ↓            ↓              ↓                       ↓
Voir le    Créer compte   Config cabinet         Copier QR link
pricing    (7j trial      + chips + Google        + Partager
           automatique)   Maps URL               aux patients
```

### Flux B — Patient (QR code → avis Google)
```
Scan QR  →  form.html  →  Étape 1 (note)  →  Étape 2 (chips)
                ↓
          Étape 3 (commentaire + suggestion IA)
                ↓
          /result → [POSITIF] Avis IA + Bouton Google Maps
                  → [NÉGATIF] Bouton WhatsApp cabinet
```

### Flux C — Médecin (consultation dashboard)
```
Login  →  Dashboard  →  [Aperçu] Stats + derniers avis
                     →  [Avis] Liste filtrée + copie avis
                     →  [Patients] Ajout + token WhatsApp
                     →  [Paramètres] Config cabinet + IA
                     →  [Premium] Upgrade via WhatsApp
```

### Flux D — Admin (gestion)
```
Admin login  →  /admin.html  →  [Stats] KPIs globaux
                             →  [Médecins] Table + activer premium
                             →  [Notifications] Trials expirés → contact WA
```

---

## 13. PRIORITÉS DE REDESIGN

### 🔴 Critique (impact conversion)
1. **Login + Register** — pages inexistantes, actuellement inline JS alert
2. **Page Result** — page résultat patient inexistante (redirect `/result` sans page HTML)
3. **Onboarding wizard** — médecin perdu après inscription

### 🟠 Important (UX)
4. Dashboard mobile responsive (sidebar cachée)
5. QR code inline dans dashboard (pas de redirect externe)
6. Score SEO visuel (gauge/donut chart 100/100)

### 🟡 Nice-to-have
7. Dark mode dashboard
8. Animations de transition entre onglets
9. Notification badge live dans la sidebar
10. Export CSV des avis

---

*Document généré le 04/05/2026 — ReviewPro SaaS v2*
*Stack : Cloudflare Pages + D1 SQLite + Workers AI (Llama 3.3 70B + 3.1 8B + bge-m3)*
