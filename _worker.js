// LOCAL SEO REVIEW ENGINE — SaaS V1 Worker
// Multi-tenant · Freemium · Auth par session cookie

// ─── Utilities ───────────────────────────────────────────────────────────────

const uuid = () => crypto.randomUUID();
const QUOTA_FREE = 30;

function makeSlug(nom, ville) {
  return (nom + '-' + ville)
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 60);
}

function currentMonth() {
  return new Date().toISOString().slice(0, 7); // "2026-05"
}

function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=UTF-8', ...headers },
  });
}

function redirect(url, status = 302) {
  return Response.redirect(url, status);
}

function randomToken(len = 8) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  const arr = new Uint8Array(len);
  crypto.getRandomValues(arr);
  return Array.from(arr, b => chars[b % chars.length]).join('');
}

// ─── WhatsApp phone normalizer ────────────────────────────────────────────────
// Converts any format to international digits only (no + sign)
// 0605932376      → 212605932376  (Moroccan local)
// +212605932376   → 212605932376
// 00212605932376  → 212605932376
// 212605932376    → 212605932376  (already good)
function formatWAPhone(phone) {
  if (!phone) return '';
  let n = String(phone).replace(/\D/g, ''); // strip everything except digits
  if (!n) return '';
  if (n.startsWith('00')) n = n.slice(2);              // 00212… → 212…
  if (n.startsWith('0') && n.length >= 9) n = '212' + n.slice(1); // 06… → 2126…
  return n;
}

// ─── Password hashing (PBKDF2) ───────────────────────────────────────────────

async function hashPassword(password) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: 100000 }, key, 256);
  const toHex = b => Array.from(b).map(x => x.toString(16).padStart(2, '0')).join('');
  return `pbkdf2:${toHex(salt)}:${toHex(new Uint8Array(bits))}`;
}

async function verifyPassword(password, stored) {
  try {
    const [, saltHex, hashHex] = stored.split(':');
    const salt = new Uint8Array(saltHex.match(/.{2}/g).map(b => parseInt(b, 16)));
    const enc = new TextEncoder();
    const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
    const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: 100000 }, key, 256);
    const computed = Array.from(new Uint8Array(bits)).map(x => x.toString(16).padStart(2, '0')).join('');
    return computed === hashHex;
  } catch { return false; }
}

// ─── Session management ───────────────────────────────────────────────────────

async function createSession(env, doctor_id) {
  const token = uuid();
  const expires = new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString();
  await env.SESSIONS_KV.put(`session:${token}`,
    JSON.stringify({ doctor_id, expires_at: expires }),
    { expirationTtl: 7 * 24 * 3600 }
  );
  return token;
}

async function getDoctor(env, request) {
  const cookie = request.headers.get('Cookie') || '';
  const match = cookie.match(/session=([^;]+)/);
  if (!match) return null;
  const data = await env.SESSIONS_KV.get(`session:${match[1]}`, 'json');
  if (!data || new Date() > new Date(data.expires_at)) return null;
  return env.DB.prepare('SELECT * FROM doctors WHERE id=? AND actif=1').bind(data.doctor_id).first();
}

function sessionCookie(token) {
  return `session=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${7 * 24 * 3600}`;
}

// ─── Premium check ───────────────────────────────────────────────────────────

function isPremium(doctor) {
  if (doctor.plan !== 'premium') return false;
  if (!doctor.plan_expires_at) return false;
  return new Date() < new Date(doctor.plan_expires_at);
}

async function checkQuota(env, doctor) {
  if (isPremium(doctor)) return true;
  const mois = currentMonth();
  if (doctor.mois_courant !== mois) {
    await env.DB.prepare("UPDATE doctors SET avis_ce_mois=0, mois_courant=? WHERE id=?").bind(mois, doctor.id).run();
    return true;
  }
  return doctor.avis_ce_mois < QUOTA_FREE;
}

// ─── AI helpers ──────────────────────────────────────────────────────────────

function cleanOutput(text) {
  if (!text) return '';
  let t = text.trim();
  const patterns = [
    /^je suis (ravi|heureux|content|prêt)[^.\n]*[.!:]\s*/i,
    /^voici (l'avis|le texte|la réponse|un exemple)[^:\n]*:\s*/i,
    /^(bien sûr|certainement|avec plaisir|absolument)[^.\n]*[.!]\s*/i,
    /^(réponse|avis amélioré|texte|résultat)\s*:\s*/i,
    /^«\s*/, /\s*»$/,
  ];
  for (const p of patterns) t = t.replace(p, '');
  if ((t.startsWith('"') && t.endsWith('"')) || (t.startsWith('«') && t.endsWith('»'))) {
    t = t.slice(1, -1).trim();
  }
  const sentences = t.match(/[^.!?]+[.!?]+/g) || [t];
  return sentences.slice(0, 3).join(' ').trim();
}

async function callLlama(env, messages, max_tokens = 200) {
  try {
    const res = await env.AI.run('@cf/meta/llama-3-8b-instruct', { messages, max_tokens });
    return cleanOutput(res.response || '');
  } catch { return ''; }
}

// ─── SEO Score ───────────────────────────────────────────────────────────────

function calcSeoScore(text, chips, doctor) {
  const spec  = (doctor.specialite || '').toLowerCase();
  const ville = (doctor.ville || '').toLowerCase();
  const vocab = JSON.parse(doctor.vocabulaire_positif || '[]');
  const t = text.toLowerCase();
  const seo_specialite  = spec  && t.includes(spec)  ? 20 : 0;
  const seo_ville       = ville && t.includes(ville)  ? 15 : 0;
  const seo_longueur    = text.length > 100           ? 10 : 0;
  const seo_chips       = chips && chips.length > 0   ?  5 : 0;
  const seo_phrases     = (text.match(/[.!?]+/g) || []).length >= 2 ? 10 : 0;
  const seo_vocabulaire = vocab.some(w => t.includes(w.toLowerCase())) ? 5 : 0;
  const words = t.split(/\s+/).filter(w => w.length > 3);
  const cnt = {}; for (const w of words) cnt[w] = (cnt[w] || 0) + 1;
  const seo_repetition  = Object.values(cnt).every(c => c <= 3) ? 5 : 0;
  return {
    seo_score: seo_specialite + seo_ville + seo_longueur + seo_chips + seo_phrases + seo_vocabulaire + seo_repetition,
    seo_specialite, seo_ville, seo_longueur, seo_chips, seo_phrases, seo_vocabulaire, seo_repetition
  };
}

// ─── ROUTE HANDLERS ──────────────────────────────────────────────────────────

// POST /api/auth/inscription
async function handleInscription(request, env) {
  const body = await request.json();
  const { nom, specialite, ville, email, password, telephone } = body;
  if (!nom || !specialite || !ville || !email || !password) return json({ error: 'Tous les champs sont requis' }, 400);
  if (password.length < 8) return json({ error: 'Mot de passe trop court (8 car. min)' }, 400);

  const existing = await env.DB.prepare('SELECT id FROM doctors WHERE email=?').bind(email.toLowerCase()).first();
  if (existing) return json({ error: 'Cet email est déjà utilisé' }, 409);

  const id = uuid();
  let slug = makeSlug(nom, ville);
  const slugExists = await env.DB.prepare('SELECT id FROM doctors WHERE slug=?').bind(slug).first();
  if (slugExists) slug = slug + '-' + id.slice(0, 4);

  const password_hash = await hashPassword(password);
  await env.DB.prepare(`
    INSERT INTO doctors (id, slug, nom, specialite, ville, email, password_hash, telephone, actif)
    VALUES (?,?,?,?,?,?,?,?,1)
  `).bind(id, slug, nom, specialite, ville, email.toLowerCase(), password_hash, telephone || '').run();

  const sessionToken = await createSession(env, id);
  return json({ ok: true, doctor_id: id, slug }, 201, {
    'Set-Cookie': sessionCookie(sessionToken)
  });
}

// POST /api/auth/login
async function handleLogin(request, env) {
  const { email, password } = await request.json();
  if (!email || !password) return json({ error: 'Email et mot de passe requis' }, 400);

  const doctor = await env.DB.prepare('SELECT * FROM doctors WHERE email=? AND actif=1').bind(email.toLowerCase()).first();
  if (!doctor) return json({ error: 'Identifiants incorrects' }, 401);

  const ok = await verifyPassword(password, doctor.password_hash);
  if (!ok) return json({ error: 'Identifiants incorrects' }, 401);

  const sessionToken = await createSession(env, doctor.id);
  return json({ ok: true, onboarded: doctor.onboarded, plan: doctor.plan, slug: doctor.slug },
    200, { 'Set-Cookie': sessionCookie(sessionToken) });
}

// POST /api/auth/logout
async function handleLogout(request, env) {
  const cookie = request.headers.get('Cookie') || '';
  const match = cookie.match(/session=([^;]+)/);
  if (match) await env.SESSIONS_KV.delete(`session:${match[1]}`);
  return json({ ok: true }, 200, {
    'Set-Cookie': 'session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0'
  });
}

// POST /api/auth/change-password
async function handleChangePassword(request, env, doctor) {
  const { new_password } = await request.json();
  if (!new_password || new_password.length < 8) return json({ error: 'Mot de passe trop court (8 car. min)' }, 400);
  const hash = await hashPassword(new_password);
  await env.DB.prepare("UPDATE doctors SET password_hash=?, updated_at=datetime('now') WHERE id=?").bind(hash, doctor.id).run();
  return json({ ok: true });
}

// POST /api/onboarding
async function handleOnboarding(request, env, doctor) {
  const body = await request.json();
  const {
    logo_url, google_maps_url, whatsapp_assistante, chips_positifs,
    langue_defaut, template_suggestion, vocabulaire_positif, telephone
  } = body;

  const chipsStr = Array.isArray(chips_positifs)
    ? JSON.stringify(chips_positifs)
    : (chips_positifs || '["Accueil","Professionnalisme","Écoute"]');

  const vocabStr = Array.isArray(vocabulaire_positif)
    ? JSON.stringify(vocabulaire_positif)
    : (vocabulaire_positif || '["professionnel","recommande","excellent"]');

  await env.DB.prepare(`
    UPDATE doctors SET
      logo_url=?, google_maps_url=?, whatsapp_assistante=?,
      chips_positifs=?, langue_defaut=?, template_suggestion=?,
      vocabulaire_positif=?, telephone=?, onboarded=1, updated_at=datetime('now')
    WHERE id=?
  `).bind(
    logo_url || '',
    google_maps_url || '',
    whatsapp_assistante || '',
    chipsStr,
    langue_defaut || 'fr',
    template_suggestion || 'Très bon accueil. Dr {nom} est un excellent {specialite} à {ville}. Je recommande vivement.',
    vocabStr,
    telephone || doctor.telephone || '',
    doctor.id
  ).run();

  return json({ ok: true, slug: doctor.slug, form_url: `/form/${doctor.slug}` });
}

// GET /api/doctor-info?slug=... — public info only, no quota check (used by QR page)
async function handleDoctorInfo(request, env) {
  const params = new URL(request.url).searchParams;
  const slug = params.get('slug');
  if (!slug) return json({ ok: false, error: 'slug requis' }, 400);
  // No actif check — QR page is public display, any doctor can have a QR poster
  const doctor = await env.DB.prepare('SELECT * FROM doctors WHERE slug=?').bind(slug).first();
  if (!doctor) return json({ ok: false, error: 'Médecin introuvable' }, 404);
  return json({
    ok: true,
    slug: doctor.slug,
    nom: doctor.nom,
    specialite: doctor.specialite,
    ville: doctor.ville,
    logo_url: doctor.logo_url || '',
    chips_positifs: JSON.parse(doctor.chips_positifs || '[]'),
    langue_defaut: doctor.langue_defaut || 'fr',
  });
}

// GET /api/form-config?slug=... OR ?token=...
async function handleFormConfig(request, env) {
  const params = new URL(request.url).searchParams;
  const slug  = params.get('slug');
  const token = params.get('token');

  if (token) {
    // WhatsApp token flow
    const kv = await env.TOKENS_KV.get(`token:${token}`, 'json');
    if (!kv)                                   return json({ ok: false, error: 'Lien invalide' }, 401);
    if (kv.used)                               return json({ ok: false, error: 'Lien déjà utilisé' }, 409);
    if (new Date() > new Date(kv.expires_at))  return json({ ok: false, error: 'Lien expiré' }, 401);

    const doctor = await env.DB.prepare('SELECT * FROM doctors WHERE id=? AND actif=1').bind(kv.doctor_id).first();
    if (!doctor) return json({ ok: false, error: 'Médecin introuvable' }, 404);

    const quotaOk = await checkQuota(env, doctor);
    if (!quotaOk) return json({ ok: false, quota: true, error: 'Limite mensuelle atteinte' }, 429);

    return json({
      ok: true, doctor_id: doctor.id, slug: doctor.slug,
      nom: doctor.nom, specialite: doctor.specialite, ville: doctor.ville,
      logo_url: doctor.logo_url,
      chips_positifs: JSON.parse(doctor.chips_positifs || '[]'),
      template_suggestion: (doctor.template_suggestion || '')
        .replace('{nom}', doctor.nom).replace('{specialite}', doctor.specialite).replace('{ville}', doctor.ville),
      langue_defaut: doctor.langue_defaut,
      ab_variante: isPremium(doctor) ? 'B' : 'A',
      canal: 'WA',
    });
  }

  if (slug) {
    const doctor = await env.DB.prepare('SELECT * FROM doctors WHERE slug=? AND actif=1').bind(slug).first();
    if (!doctor) return json({ ok: false, error: 'Médecin introuvable' }, 404);

    const quotaOk = await checkQuota(env, doctor);
    if (!quotaOk) return json({ ok: false, quota: true, error: 'Limite mensuelle atteinte' }, 429);

    return json({
      ok: true, doctor_id: doctor.id, slug: doctor.slug,
      nom: doctor.nom, specialite: doctor.specialite, ville: doctor.ville,
      logo_url: doctor.logo_url,
      chips_positifs: JSON.parse(doctor.chips_positifs || '[]'),
      template_suggestion: (doctor.template_suggestion || '')
        .replace('{nom}', doctor.nom).replace('{specialite}', doctor.specialite).replace('{ville}', doctor.ville),
      langue_defaut: doctor.langue_defaut,
      ab_variante: isPremium(doctor) ? 'B' : 'A',
      canal: 'QR',
    });
  }

  return json({ ok: false, error: 'slug ou token requis' }, 400);
}

// POST /api/feedback
async function handleFeedback(request, env) {
  const body = await request.json();
  const { doctor_id, slug, token, note, commentaire, chips_selected, canal, ab_variante } = body;

  // Resolve doctor
  let doctor = null;
  if (doctor_id) {
    doctor = await env.DB.prepare('SELECT * FROM doctors WHERE id=? AND actif=1').bind(doctor_id).first();
  } else if (slug) {
    doctor = await env.DB.prepare('SELECT * FROM doctors WHERE slug=? AND actif=1').bind(slug).first();
  }
  if (!doctor) return json({ error: 'Médecin introuvable' }, 404);
  if (!note || note < 1 || note > 5) return json({ error: 'Note invalide' }, 400);

  // Quota check
  const quotaOk = await checkQuota(env, doctor);
  if (!quotaOk) return json({ error: 'quota', message: 'Limite mensuelle atteinte (30 avis/mois gratuit)' }, 429);

  let patient_id = null;
  let canalFinal = (canal || 'QR').toUpperCase();

  // Token validation
  if (token) {
    const kv = await env.TOKENS_KV.get(`token:${token}`, 'json');
    if (!kv || kv.used || new Date() > new Date(kv.expires_at)) return json({ error: 'token_invalid' }, 401);
    patient_id = kv.patient_id;
    canalFinal = 'WA';
  }

  const chips   = Array.isArray(chips_selected) ? chips_selected : [];
  const comment = (commentaire || '').trim();
  const premium = isPremium(doctor);

  // Sentiment + type decision
  let sentiment_ia = 'NON_APPELE', type_final;
  if (note >= 4) {
    type_final = 'POSITIF';
  } else if (note <= 2) {
    type_final = 'NEGATIF';
  } else if (comment) {
    const res = await callLlama(env, [
      { role: 'system', content: 'Tu es un analyseur de sentiment. Réponds UNIQUEMENT par le mot POSITIF ou le mot NEGATIF.' },
      { role: 'user', content: `Sentiment de ce commentaire ?\n"${comment}"\nRéponse :` },
    ], 5);
    sentiment_ia = res.toUpperCase().includes('POSITIF') ? 'POSITIF' : 'NEGATIF';
    type_final = sentiment_ia;
  } else {
    type_final = 'NEGATIF';
  }

  // AI enrichment — premium gets Llama 3 enrichment; all plans get template/default suggestion
  let suggestion_ia = null;
  if (type_final === 'POSITIF') {
    if (premium && comment) {
      // Build context from ONLY what the patient actually provided
      const chipsCtx = chips.length
        ? `Points positifs mentionnés par le patient : ${chips.join(', ')}.`
        : 'Aucun point spécifique sélectionné.';

      suggestion_ia = await callLlama(env, [
        {
          role: 'system',
          content:
`Tu es un assistant qui reformule fidèlement l'avis d'un patient pour Google.

RÈGLES ABSOLUES — à ne jamais enfreindre :
1. Tu ne peux utiliser QUE les informations présentes dans le commentaire du patient et ses points sélectionnés. Aucune autre source.
2. INTERDIT d'inventer ou d'ajouter : actes médicaux, opérations, traitements, médicaments, diagnostics, équipements, durées, prix, ou tout détail absent du commentaire.
3. Si le patient n'a pas mentionné une procédure spécifique → ne l'écris pas.
4. Style : naturel, 2 phrases maximum, commence directement par l'avis (zéro introduction, zéro préambule).
5. Tu peux mentionner "${doctor.specialite}" et "${doctor.ville}" si cela s'intègre naturellement.
6. Ne change pas le sens. Si le patient dit "bien", tu peux dire "très satisfait" — jamais "opération réussie" s'il ne l'a pas dit.`,
        },
        {
          role: 'user',
          content:
`${chipsCtx}
Commentaire du patient : "${comment}"

Reformule cet avis en restant strictement fidèle à ce que le patient a écrit (commence directement) :`,
        },
      ], 200);

      // Safety check: if AI hallucinated (response too different), fallback to template
      if (suggestion_ia && suggestion_ia.length > 0) {
        // Verify no obvious hallucination keywords unrelated to input
        const inputWords = (comment + ' ' + chips.join(' ')).toLowerCase();
        const medicalKeywords = ['opération','chirurgie','intervention','anesthésie','traitement','médicament','diagnostic','prescription','ordonnance','examen','scanner','radio','biopsie','injection','greffe'];
        const hallucinationDetected = medicalKeywords.some(kw =>
          suggestion_ia.toLowerCase().includes(kw) && !inputWords.includes(kw)
        );
        if (hallucinationDetected) suggestion_ia = null;
      }
    }

    if (!suggestion_ia) {
      // All plans: use configured template or build from chips + comment
      const tmpl = (doctor.template_suggestion || '').trim();
      if (tmpl) {
        suggestion_ia = tmpl
          .replace(/\{nom\}/g, doctor.nom)
          .replace(/\{specialite\}/g, doctor.specialite)
          .replace(/\{ville\}/g, doctor.ville);
      } else if (chips.length > 0 || comment) {
        // Build honest suggestion from only what the patient provided
        const chipsStr = chips.length ? chips.slice(0, 3).join(', ') : '';
        const base = comment
          ? comment.charAt(0).toUpperCase() + comment.slice(1).replace(/\.?\s*$/, '') + '.'
          : `Très bonne expérience chez ${doctor.nom} à ${doctor.ville}.`;
        suggestion_ia = chipsStr
          ? `${base} Je recommande particulièrement pour : ${chipsStr}.`
          : base;
      }
    }
  }

  // SEO score — premium only
  const textForSeo = suggestion_ia || comment;
  const seo = (type_final === 'POSITIF' && premium && textForSeo)
    ? calcSeoScore(textForSeo, chips, doctor)
    : { seo_score: null, seo_specialite: 0, seo_ville: 0, seo_longueur: 0, seo_chips: 0, seo_phrases: 0, seo_vocabulaire: 0, seo_repetition: 0 };

  const variantFinal = ab_variante || (premium ? 'B' : 'A');
  const feedbackId = uuid();

  await env.DB.prepare(`
    INSERT INTO feedbacks (id, doctor_id, patient_id, canal, note, commentaire, chips_selected,
      sentiment_ia, type_final, suggestion_ia, seo_score, seo_specialite, seo_ville, seo_longueur,
      seo_chips, seo_phrases, seo_vocabulaire, seo_repetition, ab_variante)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
  `).bind(
    feedbackId, doctor.id, patient_id, canalFinal, note, comment, JSON.stringify(chips),
    sentiment_ia, type_final, suggestion_ia, seo.seo_score,
    seo.seo_specialite, seo.seo_ville, seo.seo_longueur, seo.seo_chips,
    seo.seo_phrases, seo.seo_vocabulaire, seo.seo_repetition, variantFinal
  ).run();

  // Update quota counter
  const mois = currentMonth();
  if (doctor.mois_courant !== mois) {
    await env.DB.prepare("UPDATE doctors SET avis_ce_mois=1, mois_courant=? WHERE id=?").bind(mois, doctor.id).run();
  } else {
    await env.DB.prepare("UPDATE doctors SET avis_ce_mois=avis_ce_mois+1 WHERE id=?").bind(doctor.id).run();
  }

  // Mark token used
  if (token) {
    const kv = await env.TOKENS_KV.get(`token:${token}`, 'json');
    if (kv) {
      kv.used = true;
      await env.TOKENS_KV.put(`token:${token}`, JSON.stringify(kv), { expirationTtl: 3600 });
    }
    await env.DB.prepare('UPDATE tokens SET used=1 WHERE token=?').bind(token).run();
  }

  if (type_final === 'POSITIF') {
    return json({
      ok: true, type: 'POSITIF',
      google_url: doctor.google_maps_url || '',
      suggestion: suggestion_ia || '',
      seo_score: seo.seo_score,
      feedback_id: feedbackId,
    });
  } else {
    const wa = formatWAPhone(doctor.whatsapp_assistante);
    return json({
      ok: true, type: 'NEGATIF',
      wa_cabinet: wa ? `https://wa.me/${wa}?text=${encodeURIComponent('Bonjour, je souhaite donner plus de détails sur ma visite')}` : null,
    });
  }
}

// POST /api/track-google
async function handleTrackGoogle(request, env) {
  const { feedback_id } = await request.json();
  if (!feedback_id) return json({ error: 'feedback_id requis' }, 400);
  await env.DB.prepare("UPDATE feedbacks SET vers_google=1 WHERE id=?").bind(feedback_id).run();
  return json({ ok: true });
}

// ─── Dashboard (auth required) ────────────────────────────────────────────────

// GET /api/dashboard — main dashboard data
async function handleDashboard(env, doctor) {
  const premium = isPremium(doctor);
  const mois = currentMonth();

  // Refresh doctor data (quota may have been reset)
  const freshDoctor = await env.DB.prepare('SELECT * FROM doctors WHERE id=?').bind(doctor.id).first();

  const [total, pos, neg, google] = await Promise.all([
    env.DB.prepare('SELECT COUNT(*) as n FROM feedbacks WHERE doctor_id=?').bind(doctor.id).first(),
    env.DB.prepare("SELECT COUNT(*) as n FROM feedbacks WHERE doctor_id=? AND type_final='POSITIF'").bind(doctor.id).first(),
    env.DB.prepare("SELECT COUNT(*) as n FROM feedbacks WHERE doctor_id=? AND type_final='NEGATIF'").bind(doctor.id).first(),
    env.DB.prepare("SELECT COUNT(*) as n FROM feedbacks WHERE doctor_id=? AND vers_google=1").bind(doctor.id).first(),
  ]);

  const { results: recent } = await env.DB.prepare(`
    SELECT * FROM feedbacks WHERE doctor_id=? ORDER BY created_at DESC LIMIT 5
  `).bind(doctor.id).all();

  return json({
    ok: true,
    base_url: env.BASE_URL || 'https://reviewpro-saas.pages.dev',
    doctor: {
      id: freshDoctor.id, nom: freshDoctor.nom, specialite: freshDoctor.specialite,
      ville: freshDoctor.ville, slug: freshDoctor.slug, email: freshDoctor.email,
      telephone: freshDoctor.telephone, logo_url: freshDoctor.logo_url,
      google_maps_url: freshDoctor.google_maps_url,
      whatsapp_assistante: freshDoctor.whatsapp_assistante,
      chips_positifs: freshDoctor.chips_positifs,
      template_suggestion: freshDoctor.template_suggestion,
      vocabulaire_positif: freshDoctor.vocabulaire_positif,
      langue_defaut: freshDoctor.langue_defaut,
      plan: premium ? 'premium' : 'free',
      plan_expires_at: freshDoctor.plan_expires_at,
      avis_ce_mois: freshDoctor.avis_ce_mois || 0,
      mois_courant: freshDoctor.mois_courant,
      onboarded: freshDoctor.onboarded,
    },
    stats: {
      total: total?.n || 0,
      positifs: pos?.n || 0,
      negatifs: neg?.n || 0,
      vers_google: google?.n || 0,
    },
    recent,
  });
}

// GET /api/feedbacks
async function handleFeedbacks(request, env, doctor) {
  const params = new URL(request.url).searchParams;
  const type   = params.get('type');   // 'POSITIF' | 'NEGATIF' | ''
  const canal  = params.get('canal');  // 'QR' | 'WA' | ''
  const period = params.get('period'); // 'week' | 'month' | ''

  const conditions = [`doctor_id='${doctor.id}'`];
  if (type)   conditions.push(`type_final='${type.toUpperCase()}'`);
  if (canal)  conditions.push(`canal='${canal.toUpperCase()}'`);
  if (period === 'week')  conditions.push("created_at>=datetime('now','-7 days')");
  if (period === 'month') conditions.push("created_at>=datetime('now','-30 days')");

  const { results } = await env.DB.prepare(`
    SELECT f.*, p.nom as patient_nom, p.telephone as patient_tel
    FROM feedbacks f LEFT JOIN patients p ON f.patient_id=p.id
    WHERE ${conditions.join(' AND ')} ORDER BY f.created_at DESC LIMIT 100
  `).all();
  return json({ ok: true, feedbacks: results });
}

// GET|POST /api/patients
async function handlePatients(request, env, doctor) {
  if (!isPremium(doctor)) return json({ error: 'Fonctionnalité Premium uniquement', premium_required: true }, 403);

  if (request.method === 'GET') {
    const q = new URL(request.url).searchParams.get('q') || '';
    let results;
    if (q) {
      const r = await env.DB.prepare(`
        SELECT p.*, COUNT(f.id) as nb_feedbacks FROM patients p
        LEFT JOIN feedbacks f ON f.patient_id=p.id
        WHERE p.doctor_id=? AND (p.nom LIKE ? OR p.telephone LIKE ?)
        GROUP BY p.id ORDER BY p.nom
      `).bind(doctor.id, `%${q}%`, `%${q}%`).all();
      results = r.results;
    } else {
      const r = await env.DB.prepare(`
        SELECT p.*, COUNT(f.id) as nb_feedbacks FROM patients p
        LEFT JOIN feedbacks f ON f.patient_id=p.id
        WHERE p.doctor_id=? GROUP BY p.id ORDER BY p.created_at DESC LIMIT 50
      `).bind(doctor.id).all();
      results = r.results;
    }
    return json({ ok: true, patients: results });
  }

  if (request.method === 'POST') {
    const { nom, telephone } = await request.json();
    if (!nom || !telephone) return json({ error: 'nom et telephone requis' }, 400);
    const existing = await env.DB.prepare('SELECT id FROM patients WHERE doctor_id=? AND telephone=?').bind(doctor.id, telephone).first();
    if (existing) return json({ error: 'Patient déjà enregistré', patient_id: existing.id }, 409);
    const id = uuid();
    await env.DB.prepare('INSERT INTO patients (id, doctor_id, nom, telephone) VALUES (?,?,?,?)')
      .bind(id, doctor.id, nom, telephone).run();
    return json({ ok: true, id, nom, telephone }, 201);
  }

  return json({ error: 'Method not allowed' }, 405);
}

// POST /api/tokens/generate
async function handleGenerateToken(request, env, doctor) {
  if (!isPremium(doctor)) return json({ error: 'Fonctionnalité Premium uniquement', premium_required: true }, 403);

  const { patient_id } = await request.json();
  if (!patient_id) return json({ error: 'patient_id requis' }, 400);

  const patient = await env.DB.prepare('SELECT * FROM patients WHERE id=? AND doctor_id=?').bind(patient_id, doctor.id).first();
  if (!patient) return json({ error: 'Patient introuvable' }, 404);

  const token = randomToken(8);
  const expires = new Date(Date.now() + 48 * 3600 * 1000).toISOString();

  await env.TOKENS_KV.put(
    `token:${token}`,
    JSON.stringify({ doctor_id: doctor.id, patient_id, used: false, expires_at: expires }),
    { expirationTtl: 3600 * 48 }
  );
  await env.DB.prepare('INSERT INTO tokens (token, doctor_id, patient_id, used, expires_at) VALUES (?,?,?,0,?)')
    .bind(token, doctor.id, patient_id, expires).run();

  const baseUrl = env.BASE_URL || 'https://reviewpro-saas.pages.dev';
  const link = `${baseUrl}/r/${token}`;
  const message = `Bonjour ${patient.nom} 👋\n\nMerci pour votre visite chez ${doctor.nom}.\nVotre avis est très précieux pour nous 🙏\n\n${link}\n\n(Lien valable 48h)`;

  const phoneNum = formatWAPhone(patient.telephone);
  const wa_url = phoneNum
    ? `https://wa.me/${phoneNum}?text=${encodeURIComponent(message)}`
    : null;

  return json({ ok: true, token, link, message, wa_url });
}

// PUT /api/config
async function handleConfig(request, env, doctor) {
  const body = await request.json();
  const allowed = [
    'nom', 'specialite', 'ville', 'telephone', 'logo_url',
    'google_maps_url', 'whatsapp_assistante',
    'chips_positifs', 'template_suggestion', 'vocabulaire_positif', 'langue_defaut',
  ];
  const updates = [];
  const vals = [];
  for (const f of allowed) {
    if (body[f] !== undefined) {
      let val = body[f];
      if (f === 'chips_positifs' && Array.isArray(val)) val = JSON.stringify(val);
      if (f === 'vocabulaire_positif' && Array.isArray(val)) val = JSON.stringify(val);
      updates.push(`${f}=?`);
      vals.push(val);
    }
  }
  if (!updates.length) return json({ ok: true });
  vals.push(doctor.id);
  await env.DB.prepare(`UPDATE doctors SET ${updates.join(',')}, updated_at=datetime('now') WHERE id=?`)
    .bind(...vals).run();
  const updated = await env.DB.prepare('SELECT * FROM doctors WHERE id=?').bind(doctor.id).first();
  return json({ ok: true, doctor: updated });
}

// POST /api/upgrade
async function handleUpgrade(request, env, doctor) {
  // Build wa_url first — always returned regardless of request status
  // Priority: KV-stored admin_wa > env.ADMIN_WA
  const kvWa = await env.SESSIONS_KV.get('admin_wa');
  const adminWa = kvWa || formatWAPhone(env.ADMIN_WA);
  const msg = `🚀 Demande Premium — ReviewPro\nMédecin : ${doctor.nom}\nSpécialité : ${doctor.specialite}\nVille : ${doctor.ville}\nEmail : ${doctor.email}\nAvis ce mois : ${doctor.avis_ce_mois || 0}\n\nActiver le compte sur /admin`;
  const wa_url = adminWa ? `https://wa.me/${adminWa}?text=${encodeURIComponent(msg)}` : null;

  const existing = await env.DB.prepare(
    "SELECT id FROM upgrade_requests WHERE doctor_id=? AND statut='en_attente'"
  ).bind(doctor.id).first();

  if (existing) {
    // Already pending — just return wa_url so user can resend WhatsApp
    return json({ ok: true, statut: 'deja_en_attente', wa_url });
  }

  await env.DB.prepare('INSERT INTO upgrade_requests (id, doctor_id) VALUES (?,?)').bind(uuid(), doctor.id).run();
  return json({ ok: true, statut: 'en_attente', wa_url });
}

// ─── Super-Admin ──────────────────────────────────────────────────────────────

function isAdmin(request, env) {
  const cfEmail = request.headers.get('CF-Access-Authenticated-User-Email');
  if (cfEmail && cfEmail === env.ADMIN_EMAIL) return true;
  const key = request.headers.get('X-Admin-Key');
  return key && env.ADMIN_SECRET && key === env.ADMIN_SECRET;
}

// GET /api/admin/stats
async function handleAdminStats(env) {
  const [total, premium, avis, pending] = await Promise.all([
    env.DB.prepare('SELECT COUNT(*) as n FROM doctors').first(),
    env.DB.prepare("SELECT COUNT(*) as n FROM doctors WHERE plan='premium'").first(),
    env.DB.prepare('SELECT COUNT(*) as n FROM feedbacks').first(),
    env.DB.prepare("SELECT COUNT(*) as n FROM upgrade_requests WHERE statut='en_attente'").first(),
  ]);
  return json({
    ok: true,
    total_doctors: total?.n || 0,
    premium_doctors: premium?.n || 0,
    total_feedbacks: avis?.n || 0,
    pending_upgrades: pending?.n || 0,
    admin_email: env.ADMIN_EMAIL || '',
  });
}

// GET /api/admin/doctors
async function handleAdminDoctors(env) {
  const { results } = await env.DB.prepare(`
    SELECT d.*, COUNT(f.id) as total_feedbacks
    FROM doctors d LEFT JOIN feedbacks f ON f.doctor_id=d.id
    GROUP BY d.id ORDER BY d.created_at DESC
  `).all();
  return json({ ok: true, doctors: results });
}

// GET /api/admin/upgrades
async function handleAdminUpgrades(env) {
  const { results } = await env.DB.prepare(`
    SELECT u.*, d.nom as doctor_nom, d.email as doctor_email, d.ville as doctor_ville,
           d.specialite as doctor_specialite, d.avis_ce_mois as doctor_avis_mois
    FROM upgrade_requests u
    LEFT JOIN doctors d ON u.doctor_id=d.id
    ORDER BY u.created_at DESC LIMIT 50
  `).all();
  return json({ ok: true, requests: results });
}

// POST /api/admin/set-plan
async function handleAdminSetPlan(request, env) {
  const { doctor_id, plan, plan_expires_at } = await request.json();
  if (!doctor_id || !plan) return json({ error: 'doctor_id et plan requis' }, 400);
  await env.DB.prepare("UPDATE doctors SET plan=?, plan_expires_at=? WHERE id=?")
    .bind(plan, plan_expires_at || null, doctor_id).run();
  if (plan === 'premium') {
    await env.DB.prepare("UPDATE upgrade_requests SET statut='approuve' WHERE doctor_id=? AND statut='en_attente'")
      .bind(doctor_id).run();
  }
  return json({ ok: true });
}

// POST /api/admin/toggle-actif
async function handleAdminToggleActif(request, env) {
  const { doctor_id, actif } = await request.json();
  if (doctor_id === undefined) return json({ error: 'doctor_id requis' }, 400);
  await env.DB.prepare("UPDATE doctors SET actif=? WHERE id=?").bind(actif ? 1 : 0, doctor_id).run();
  return json({ ok: true });
}

// POST /api/admin/upgrade-status
async function handleAdminUpgradeStatus(request, env) {
  const { request_id, statut } = await request.json();
  if (!request_id || !statut) return json({ error: 'request_id et statut requis' }, 400);
  await env.DB.prepare("UPDATE upgrade_requests SET statut=? WHERE id=?").bind(statut, request_id).run();
  return json({ ok: true });
}

// POST /api/admin/create-doctor
async function handleAdminCreate(request, env) {
  const { nom, specialite, ville, email, password, plan, months, google_maps_url, whatsapp_assistante } = await request.json();
  if (!nom || !specialite || !ville || !email || !password) return json({ error: 'Champs obligatoires manquants' }, 400);

  const existing = await env.DB.prepare('SELECT id FROM doctors WHERE email=?').bind(email.toLowerCase()).first();
  if (existing) return json({ error: 'Email déjà utilisé' }, 409);

  const id = uuid();
  let slug = makeSlug(nom, ville);
  const slugExists = await env.DB.prepare('SELECT id FROM doctors WHERE slug=?').bind(slug).first();
  if (slugExists) slug = slug + '-' + id.slice(0, 4);

  const password_hash = await hashPassword(password);
  const planFinal = plan || 'free';
  const expires = planFinal === 'premium'
    ? new Date(Date.now() + (parseInt(months) || 1) * 30 * 24 * 3600 * 1000).toISOString()
    : null;

  await env.DB.prepare(`
    INSERT INTO doctors (id, slug, nom, specialite, ville, email, password_hash, plan, plan_expires_at,
      google_maps_url, whatsapp_assistante, onboarded, actif)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,1,1)
  `).bind(id, slug, nom, specialite, ville, email.toLowerCase(), password_hash, planFinal, expires,
    google_maps_url || '', whatsapp_assistante || '').run();

  return json({ ok: true, id, slug, email, plan: planFinal }, 201);
}

// GET /api/admin/settings
async function handleAdminGetSettings(env) {
  const adminWa = await env.SESSIONS_KV.get('admin_wa') || env.ADMIN_WA || '';
  return json({ ok: true, admin_wa: adminWa });
}

// POST /api/admin/settings
async function handleAdminSaveSettings(request, env) {
  const { admin_wa } = await request.json();
  if (admin_wa === undefined) return json({ error: 'admin_wa requis' }, 400);
  const normalized = formatWAPhone(admin_wa);
  if (admin_wa && !normalized) return json({ error: 'Numéro WhatsApp invalide' }, 400);
  if (normalized) {
    await env.SESSIONS_KV.put('admin_wa', normalized);
  } else {
    await env.SESSIONS_KV.delete('admin_wa');
  }
  return json({ ok: true, admin_wa: normalized });
}

// POST /api/admin/delete-doctor
async function handleAdminDeleteDoctor(request, env) {
  const { doctor_id } = await request.json();
  if (!doctor_id) return json({ error: 'doctor_id requis' }, 400);

  const doctor = await env.DB.prepare('SELECT id, nom FROM doctors WHERE id=?').bind(doctor_id).first();
  if (!doctor) return json({ error: 'Médecin introuvable' }, 404);

  // Cascade delete in dependency order
  await env.DB.prepare('DELETE FROM upgrade_requests WHERE doctor_id=?').bind(doctor_id).run();
  await env.DB.prepare('DELETE FROM sessions WHERE doctor_id=?').bind(doctor_id).run();
  await env.DB.prepare('DELETE FROM feedbacks WHERE doctor_id=?').bind(doctor_id).run();
  await env.DB.prepare('DELETE FROM tokens WHERE doctor_id=?').bind(doctor_id).run();
  await env.DB.prepare('DELETE FROM patients WHERE doctor_id=?').bind(doctor_id).run();
  await env.DB.prepare('DELETE FROM doctors WHERE id=?').bind(doctor_id).run();

  return json({ ok: true, deleted: doctor.nom });
}

// ─── QR page route: /qr/[slug] → serve qr.html ───────────────────────────────

// ─── Main fetch handler ───────────────────────────────────────────────────────

export default {
  async fetch(request, env) {
    const url    = new URL(request.url);
    const path   = url.pathname;
    const method = request.method;

    // CORS preflight
    if (method === 'OPTIONS') {
      return new Response(null, { headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, X-Admin-Key',
      }});
    }

    try {
      // ── /form/[slug] → serve form.html with slug in query
      const formMatch = path.match(/^\/form\/([^/]+)$/);
      if (formMatch) {
        // Serve the static form.html page — the form reads ?slug= from JS
        const newUrl = new URL(request.url);
        newUrl.pathname = '/form.html';
        newUrl.searchParams.set('slug', formMatch[1]);
        return redirect(newUrl.toString(), 302);
      }

      // ── /qr/[slug] → serve qr.html
      const qrMatch = path.match(/^\/qr\/([^/]+)$/);
      if (qrMatch) {
        const newUrl = new URL(request.url);
        newUrl.pathname = '/qr.html';
        newUrl.searchParams.set('slug', qrMatch[1]);
        return redirect(newUrl.toString(), 302);
      }

      // ── /r/[TOKEN] → validate and redirect to form
      const rMatch = path.match(/^\/r\/([^/]+)$/);
      if (rMatch) {
        const token = rMatch[1];
        const kv = await env.TOKENS_KV.get(`token:${token}`, 'json');
        if (!kv)                                   return redirect('/token-error?reason=invalid');
        if (kv.used)                               return redirect('/token-error?reason=used');
        if (new Date() > new Date(kv.expires_at))  return redirect('/token-error?reason=expired');
        return redirect(`/form?token=${token}`, 302);
      }

      // ── /form?token= → serve form.html
      if (path === '/form' && url.searchParams.get('token')) {
        return env.ASSETS.fetch(new Request(new URL('/form.html', url.origin)));
      }

      // ── Auth endpoints
      if (path === '/api/auth/inscription'     && method === 'POST') return handleInscription(request, env);
      if (path === '/api/auth/login'           && method === 'POST') return handleLogin(request, env);
      if (path === '/api/auth/logout'          && method === 'POST') return handleLogout(request, env);
      if (path === '/api/auth/change-password' && method === 'POST') {
        const doc = await getDoctor(env, request);
        if (!doc) return json({ error: 'Non authentifié' }, 401);
        return handleChangePassword(request, env, doc);
      }

      // ── Onboarding
      if (path === '/api/onboarding' && method === 'POST') {
        const doc = await getDoctor(env, request);
        if (!doc) return json({ error: 'Non authentifié' }, 401);
        return handleOnboarding(request, env, doc);
      }

      // ── Public doctor info (no quota check — for QR page)
      if (path === '/api/doctor-info' && method === 'GET') return handleDoctorInfo(request, env);

      // ── Public form config (slug or token)
      if (path === '/api/form-config' && method === 'GET') return handleFormConfig(request, env);

      // ── Feedback (public)
      if (path === '/api/feedback'    && method === 'POST') return handleFeedback(request, env);
      if (path === '/api/track-google' && method === 'POST') return handleTrackGoogle(request, env);

      // ── Dashboard (auth required)
      if (path === '/api/dashboard' && method === 'GET') {
        const doc = await getDoctor(env, request);
        if (!doc) return json({ error: 'Non authentifié' }, 401);
        return handleDashboard(env, doc);
      }

      if (path === '/api/feedbacks' && method === 'GET') {
        const doc = await getDoctor(env, request);
        if (!doc) return json({ error: 'Non authentifié' }, 401);
        return handleFeedbacks(request, env, doc);
      }

      if (path === '/api/patients') {
        const doc = await getDoctor(env, request);
        if (!doc) return json({ error: 'Non authentifié' }, 401);
        return handlePatients(request, env, doc);
      }

      if (path === '/api/tokens/generate' && method === 'POST') {
        const doc = await getDoctor(env, request);
        if (!doc) return json({ error: 'Non authentifié' }, 401);
        return handleGenerateToken(request, env, doc);
      }

      if (path === '/api/config' && method === 'PUT') {
        const doc = await getDoctor(env, request);
        if (!doc) return json({ error: 'Non authentifié' }, 401);
        return handleConfig(request, env, doc);
      }

      // ── Upgrade
      if (path === '/api/upgrade' && method === 'POST') {
        const doc = await getDoctor(env, request);
        if (!doc) return json({ error: 'Non authentifié' }, 401);
        return handleUpgrade(request, env, doc);
      }

      // ── Super-admin
      if (path.startsWith('/api/admin/')) {
        if (!isAdmin(request, env)) return json({ error: 'Accès refusé' }, 403);
        if (path === '/api/admin/stats'          && method === 'GET' ) return handleAdminStats(env);
        if (path === '/api/admin/doctors'        && method === 'GET' ) return handleAdminDoctors(env);
        if (path === '/api/admin/upgrades'       && method === 'GET' ) return handleAdminUpgrades(env);
        if (path === '/api/admin/set-plan'       && method === 'POST') return handleAdminSetPlan(request, env);
        if (path === '/api/admin/toggle-actif'   && method === 'POST') return handleAdminToggleActif(request, env);
        if (path === '/api/admin/upgrade-status' && method === 'POST') return handleAdminUpgradeStatus(request, env);
        if (path === '/api/admin/create-doctor'  && method === 'POST') return handleAdminCreate(request, env);
        if (path === '/api/admin/delete-doctor'  && method === 'POST') return handleAdminDeleteDoctor(request, env);
        if (path === '/api/admin/settings'       && method === 'GET' ) return handleAdminGetSettings(env);
        if (path === '/api/admin/settings'       && method === 'POST') return handleAdminSaveSettings(request, env);
        return json({ error: 'Route admin inconnue' }, 404);
      }

      // ── Static assets (Pages serves HTML, CSS, JS, images)
      return env.ASSETS.fetch(request);

    } catch (err) {
      console.error('Worker error:', err);
      return json({ error: 'Erreur serveur', details: err.message }, 500);
    }
  },
};
