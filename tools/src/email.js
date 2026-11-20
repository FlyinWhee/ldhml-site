// Sending the sign-in code. EMAIL_MODE (wrangler.jsonc "vars"):
//   "console"  local development only: the code goes to the Worker log. Refused on any other host than localhost.
//   "resend"   Resend (resend.com, free plan: 100 emails a day). Needs the RESEND_API_KEY secret and EMAIL_FROM on a verified domain.
//   "cloudflare" Cloudflare Email Service (Workers Paid; decided 2026-10-16): the EMAIL binding (send_email in wrangler.jsonc)
//              and EMAIL_FROM on the onboarded domain (no-reply@ldhml.com). Can send to any address once the domain is onboarded.
import { isLocal } from './http.js';

export async function sendCode(env, url, to, code) {
  const subject = 'Code de connexion LDHML / LDHML sign-in code';
  const text = `Votre code de connexion LDHML : ${code}\nIl expire dans 10 minutes. Si vous n’avez rien demandé, ignorez ce courriel.\n\n` +
    `Your LDHML sign-in code: ${code}\nIt expires in 10 minutes. If you did not ask for it, ignore this email.`;
  if (env.EMAIL_MODE === 'console') {
    if (!isLocal(url)) throw new Error('EMAIL_MODE "console" is for local development only');
    console.log(`[dev] sign-in code for ${to}: ${code}`);
    return;
  }
  if (env.EMAIL_MODE === 'cloudflare') {
    if (!env.EMAIL || !env.EMAIL_FROM) throw new Error('the EMAIL binding or EMAIL_FROM is missing');
    try { await env.EMAIL.send({ to, from: { email: env.EMAIL_FROM, name: 'LDHML' }, subject, text }); }
    catch (e) { throw new Error('Email Service: ' + (e.code || '') + ' ' + e.message); }   // the code never goes to the log
    return;
  }
  if (env.EMAIL_MODE === 'resend') {
    if (!env.RESEND_API_KEY || !env.EMAIL_FROM) throw new Error('RESEND_API_KEY or EMAIL_FROM is missing');
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: env.EMAIL_FROM, to: [to], subject, text })
    });
    if (!r.ok) throw new Error('Resend answered ' + r.status);
    return;
  }
  throw new Error('EMAIL_MODE is not set');
}
