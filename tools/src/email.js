// Sending the sign-in code. EMAIL_MODE (wrangler.jsonc "vars"):
//   "console"  local development only: the code goes to the Worker log. Refused on any other host than localhost.
//   "resend"   Resend (resend.com, free plan: 100 emails a day). Needs the RESEND_API_KEY secret and EMAIL_FROM on a verified domain.
//   "cloudflare" Cloudflare Email Service (Workers Paid; decided 2026-10-16): the EMAIL binding (send_email in wrangler.jsonc)
//              and EMAIL_FROM on the onboarded domain (no-reply@ldhml.com). Can send to any address once the domain is onboarded.
import { isLocal } from './http.js';

/** The sign-in link (owner, 2026-11-20: "less annoying than a code"): the page of the area, with the code and the email in the
 *  fragment (never sent to a server, removed from the address bar at once). It opens the form filled in; the person clicks
 *  "Se connecter" (never automatic: mail scanners open links and would use the single-use code). */
export const signInLink = (base, to, code) => base + '#connexion=' + code + '-' + encodeURIComponent(to);

export async function sendCode(env, url, to, code, link) {
  const subject = 'Connexion LDHML / LDHML sign-in';
  const text = (link ? `Pour vous connecter, ouvrez ce lien :\n${link}\n\nOu entrez ce code : ${code}\n` : `Votre code de connexion LDHML : ${code}\n`) +
    `Le lien et le code expirent dans 10 minutes. Si vous n’avez rien demandé, ignorez ce courriel.\n\n` +
    (link ? `To sign in, open this link:\n${link}\n\nOr enter this code: ${code}\n` : `Your LDHML sign-in code: ${code}\n`) +
    `The link and the code expire in 10 minutes. If you did not ask for it, ignore this email.`;
  const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const html = link ? `<div style="font-family:Arial,sans-serif;font-size:16px;line-height:1.5;color:#111">
<p><a href="${esc(link)}" style="display:inline-block;padding:12px 22px;background:#ff5a1f;color:#fff;text-decoration:none;border-radius:4px;font-weight:bold">Me connecter / Sign in</a></p>
<p>Ou entrez ce code / Or enter this code: <b style="font-size:20px;letter-spacing:2px">${code}</b></p>
<p style="color:#666;font-size:13px">Le lien et le code expirent dans 10 minutes. Si vous n’avez rien demandé, ignorez ce courriel.<br>The link and the code expire in 10 minutes. If you did not ask for it, ignore this email.</p></div>` : null;
  if (env.EMAIL_MODE === 'console') {
    if (!isLocal(url)) throw new Error('EMAIL_MODE "console" is for local development only');
    console.log(`[dev] sign-in code for ${to}: ${code}${link ? ' ' + link : ''}`);
    return;
  }
  if (env.EMAIL_MODE === 'cloudflare') {
    if (!env.EMAIL || !env.EMAIL_FROM) throw new Error('the EMAIL binding or EMAIL_FROM is missing');
    try { await env.EMAIL.send({ to, from: { email: env.EMAIL_FROM, name: 'LDHML' }, subject, text, ...(html ? { html } : {}) }); }
    catch (e) { throw new Error('Email Service: ' + (e.code || '') + ' ' + e.message); }   // the code never goes to the log
    return;
  }
  if (env.EMAIL_MODE === 'resend') {
    if (!env.RESEND_API_KEY || !env.EMAIL_FROM) throw new Error('RESEND_API_KEY or EMAIL_FROM is missing');
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: env.EMAIL_FROM, to: [to], subject, text, ...(html ? { html } : {}) })
    });
    if (!r.ok) throw new Error('Resend answered ' + r.status);
    return;
  }
  throw new Error('EMAIL_MODE is not set');
}
