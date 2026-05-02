-- LOCAL SEO REVIEW ENGINE — SaaS V1 Multi-tenant Schema

CREATE TABLE IF NOT EXISTS doctors (
  id                  TEXT PRIMARY KEY,
  slug                TEXT UNIQUE NOT NULL,
  nom                 TEXT NOT NULL,
  specialite          TEXT NOT NULL,
  ville               TEXT NOT NULL,
  telephone           TEXT DEFAULT '',
  email               TEXT UNIQUE NOT NULL,
  password_hash       TEXT NOT NULL,
  logo_url            TEXT DEFAULT '',
  google_maps_url     TEXT DEFAULT '',
  whatsapp_assistante TEXT DEFAULT '',
  chips_positifs      TEXT DEFAULT '["Accueil","Professionnalisme","Explications","Temps d''attente","Propreté","Écoute"]',
  template_suggestion TEXT DEFAULT 'Très bon accueil. Dr {nom} est un excellent {specialite} à {ville}. Je recommande vivement.',
  vocabulaire_positif TEXT DEFAULT '["professionnel","recommande","excellent","qualité","confiance","mzyan","biyn"]',
  langue_defaut       TEXT DEFAULT 'fr',
  plan                TEXT DEFAULT 'free',
  plan_expires_at     TEXT,
  avis_ce_mois        INT  DEFAULT 0,
  mois_courant        TEXT DEFAULT '',
  actif               INT  DEFAULT 1,
  onboarded           INT  DEFAULT 0,
  created_at          TEXT DEFAULT (datetime('now')),
  updated_at          TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS patients (
  id          TEXT PRIMARY KEY,
  doctor_id   TEXT NOT NULL REFERENCES doctors(id),
  nom         TEXT NOT NULL,
  telephone   TEXT NOT NULL,
  created_at  TEXT DEFAULT (datetime('now')),
  UNIQUE(doctor_id, telephone)
);

CREATE TABLE IF NOT EXISTS tokens (
  token       TEXT PRIMARY KEY,
  doctor_id   TEXT NOT NULL REFERENCES doctors(id),
  patient_id  TEXT REFERENCES patients(id),
  used        INTEGER DEFAULT 0,
  expires_at  TEXT NOT NULL,
  created_at  TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS feedbacks (
  id              TEXT PRIMARY KEY,
  doctor_id       TEXT NOT NULL REFERENCES doctors(id),
  patient_id      TEXT,
  canal           TEXT NOT NULL,
  note            INTEGER NOT NULL,
  commentaire     TEXT,
  chips_selected  TEXT DEFAULT '[]',
  sentiment_ia    TEXT DEFAULT 'NON_APPELE',
  type_final      TEXT NOT NULL,
  suggestion_ia   TEXT,
  seo_score       INTEGER,
  seo_specialite  INTEGER DEFAULT 0,
  seo_ville       INTEGER DEFAULT 0,
  seo_longueur    INTEGER DEFAULT 0,
  seo_chips       INTEGER DEFAULT 0,
  seo_phrases     INTEGER DEFAULT 0,
  seo_vocabulaire INTEGER DEFAULT 0,
  seo_repetition  INTEGER DEFAULT 0,
  vers_google     INTEGER DEFAULT 0,
  step_abandon    TEXT,
  ab_variante     TEXT,
  created_at      TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS sessions (
  token       TEXT PRIMARY KEY,
  doctor_id   TEXT NOT NULL REFERENCES doctors(id),
  expires_at  TEXT NOT NULL,
  created_at  TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS upgrade_requests (
  id          TEXT PRIMARY KEY,
  doctor_id   TEXT REFERENCES doctors(id),
  statut      TEXT DEFAULT 'en_attente',
  created_at  TEXT DEFAULT (datetime('now'))
);
