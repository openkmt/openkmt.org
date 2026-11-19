// POST /api/chat — assistant d'accueil de openkmt.org (proposer un projet / contribuer).
// LLM via DeepInfra (API compatible OpenAI). Quand le dossier est complet et validé par la
// personne, le modèle émet une ligne `<<DOSSIER>>{json}` : on l'envoie sur Telegram.
// Secrets Pages : DEEPINFRA_API_KEY, TG_TOKEN, TG_CHAT. Optionnel : LLM_MODEL.
const MODEL = 'Qwen/Qwen3-235B-A22B-Instruct-2507';
const MAX_TURNS = 24, MAX_LEN = 2000;
const json = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { 'content-type': 'application/json' } });
const esc = s => String(s ?? '').replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));

const BASE = `Tu es l'accueil de KMT (Kemet), la fondation open source africaine (« Le logiciel libre africain. », openkmt.org).
KMT porte des logiciels libres pour les entreprises africaines : Zeno (relation client : prospects, contrats, paiements), EDMS (sites, contenus, documents), Gestion (factures, stocks, compta en franc CFA, en chantier), DevPanel (atelier où des agents écrivent le code et des humains le relisent). Lancement de la fondation en janvier 2027. Code, marque et gouvernance portés par une structure à but non lucratif.
Style : français (passe à l'anglais si la personne écrit en anglais), tutoiement, chaleureux et direct, réponses COURTES (2-3 phrases max), UNE seule question à la fois. Pas de listes à rallonge, pas de jargon. N'invente jamais de dates, de montants, de financements ou d'engagements : si tu ne sais pas, dis que l'équipe répondra.
Si la question sort du sujet KMT, réponds en une phrase et ramène gentiment au sujet.`;

const MODES = {
  projet: `${BASE}
Mission : recueillir une candidature à l'appel à projets (première vague). Infos à obtenir, une par une, en t'adaptant à ce que la personne a déjà dit :
1. prénom et nom ; 2. email (obligatoire, pour la réponse) ; 3. nom du projet ; 4. le problème résolu et pour qui (pays/ville, type d'entreprise) ; 5. ce qui marche déjà (prototype, utilisateurs, en ligne ?) ; 6. lien du dépôt (GitHub/GitLab) et licence si elle existe ; 7. ce que la personne attend de KMT.
Facultatif : lien vers une présentation ou une démo, taille de l'équipe.
Quand tu as au moins 1, 2, 3, 4 et 5 : fais un récapitulatif court et demande « Je l'envoie à l'équipe ? ». Seulement après un oui explicite, réponds par une phrase de confirmation (on répond sous 72 h) puis, sur une NOUVELLE ligne à la toute fin, exactement :
<<DOSSIER>>{"type":"projet","nom":"","email":"","projet":"","probleme":"","existant":"","depot":"","attentes":"","extras":""}
(JSON sur une ligne, valeurs remplies, chaînes vides si inconnu). N'émets jamais cette ligne avant le oui.`,
  contribuer: `${BASE}
Mission : accueillir quelqu'un qui veut contribuer sans projet à lui. Infos à obtenir, une par une :
1. prénom ; 2. email (obligatoire) ; 3. terrain : code, documentation, design, traduction, tests/retours, ou autre ; 4. niveau / ce qu'il ou elle sait faire (langages, outils) ; 5. temps disponible ; 6. GitHub (facultatif) ; 7. produit qui l'attire (Zeno, EDMS, Gestion, DevPanel, peu importe).
Quand tu as 1, 2, 3 et 4 : récapitulatif court, « Je l'envoie à l'équipe ? ». Après un oui explicite seulement : phrase de confirmation (on répond sous 72 h avec une première tâche) puis, sur une NOUVELLE ligne à la fin, exactement :
<<DOSSIER>>{"type":"contribuer","nom":"","email":"","terrain":"","competences":"","dispo":"","github":"","produit":"","extras":""}
N'émets jamais cette ligne avant le oui.`,
};

async function notify(env, d) {
  if (!env.TG_TOKEN || !env.TG_CHAT) return false;
  const titre = d.type === 'projet' ? 'Nouvelle candidature · appel à projets' : 'Nouvelle contribution';
  const lignes = Object.entries(d).filter(([k, v]) => k !== 'type' && String(v || '').trim())
    .map(([k, v]) => `<b>${esc(k)}</b> : ${esc(String(v).slice(0, 600))}`);
  const email = String(d.email || '').trim();
  const body = { chat_id: env.TG_CHAT, parse_mode: 'HTML', disable_web_page_preview: true,
    text: `<b>${titre}</b> (via le chat du site)\n\n${lignes.join('\n')}` };
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) body.reply_markup = { inline_keyboard: [[{ text: 'Répondre par mail',
    url: `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(email)}&su=${encodeURIComponent(d.type === 'projet' ? `Ta candidature KMT${d.projet ? ' · ' + d.projet : ''}` : 'Ta contribution à KMT')}` }]] };
  const r = await fetch(`https://api.telegram.org/bot${env.TG_TOKEN}/sendMessage`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  return r.ok;
}

export async function onRequestPost({ request, env }) {
  let b; try { b = await request.json(); } catch { return json({ error: 'bad_request' }, 400); }
  const mode = MODES[b.mode] ? b.mode : 'projet';
  const msgs = Array.isArray(b.messages) ? b.messages.slice(-MAX_TURNS) : [];
  const clean = msgs.filter(m => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
    .map(m => ({ role: m.role, content: m.content.slice(0, MAX_LEN) }));
  if (!clean.length || clean[clean.length - 1].role !== 'user') return json({ error: 'bad_request' }, 400);
  if (!env.DEEPINFRA_API_KEY) return json({ error: 'not_configured' }, 503);

  const r = await fetch('https://api.deepinfra.com/v1/openai/chat/completions', {
    method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${env.DEEPINFRA_API_KEY}` },
    body: JSON.stringify({ model: env.LLM_MODEL || MODEL, temperature: 0.4, max_tokens: 500,
      messages: [{ role: 'system', content: MODES[mode] }, ...clean] }),
  });
  if (!r.ok) return json({ error: 'llm_failed' }, 502);
  const out = await r.json();
  let reply = String(out?.choices?.[0]?.message?.content || '').replace(/<think>[\s\S]*?<\/think>/g, '').trim();
  let done = false, sent = false;
  const m = reply.match(/<<DOSSIER>>\s*(\{[\s\S]*\})\s*$/);
  if (m) {
    reply = reply.slice(0, m.index).trim();
    try { const d = JSON.parse(m[1]); d.type = mode; sent = await notify(env, d); done = true; } catch { /* JSON invalide : on continue la conversation */ }
  }
  return json({ reply: reply || 'Bien reçu.', done, sent });
}
