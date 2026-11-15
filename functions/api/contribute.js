// POST /api/contribute — reçoit le formulaire « Contribuer » et le pousse sur Telegram.
// Secrets Pages requis : TG_TOKEN (token du bot), TG_CHAT (chat id destinataire).
const esc = s => String(s || '').replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
const json = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { 'content-type': 'application/json' } });

export async function onRequestPost({ request, env }) {
  let d;
  try { d = await request.json(); } catch { return json({ ok: false, error: 'bad_request' }, 400); }
  if (d.site) return json({ ok: true }); // honeypot : les bots remplissent ce champ caché
  const nom = String(d.nom || '').trim().slice(0, 80);
  const email = String(d.email || '').trim().slice(0, 120);
  const terrain = String(d.terrain || '').trim().slice(0, 60);
  const gh = String(d.gh || '').trim().slice(0, 200);
  const msg = String(d.msg || '').trim().slice(0, 2000);
  if (!nom || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ ok: false, error: 'invalid' }, 422);
  if (!env.TG_TOKEN || !env.TG_CHAT) return json({ ok: false, error: 'not_configured' }, 503);

  const text = `<b>Nouvelle contribution Kemet</b>\n\n<b>${esc(nom)}</b> · ${esc(email)}\nTerrain : ${esc(terrain)}` +
    (gh ? `\nGitHub : ${esc(gh)}` : '') + (msg ? `\n\n${esc(msg)}` : '');
  const reply = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(email)}&su=${encodeURIComponent('Re: ta contribution à Kemet')}&body=${encodeURIComponent(`Bonjour ${nom},\n\nMerci pour ton message !\n\n`)}`;
  const r = await fetch(`https://api.telegram.org/bot${env.TG_TOKEN}/sendMessage`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ chat_id: env.TG_CHAT, text, parse_mode: 'HTML', disable_web_page_preview: true,
      reply_markup: { inline_keyboard: [[{ text: 'Répondre par mail', url: reply }]] } }),
  });
  return r.ok ? json({ ok: true }) : json({ ok: false, error: 'send_failed' }, 502);
}
