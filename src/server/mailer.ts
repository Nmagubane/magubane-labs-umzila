/**
 * Email delivery behind one function. Providers: Brevo or Resend (plain HTTPS, no SDK), or 'log',
 * which prints the email to the server log so the app stays usable before a provider is set up.
 */
import { config } from './config.ts';

export interface Attachment {
  filename: string;
  content: Buffer;
}
export interface Mail {
  to: { email: string; name?: string };
  subject: string;
  text: string;
  html: string;
  attachments?: Attachment[];
}
export type MailResult = { status: 'sent' | 'logged' } | { status: 'failed'; error: string };

/** Replaceable in tests. */
let transport: (mail: Mail) => Promise<MailResult> = send;
export function setTransport(fn: ((mail: Mail) => Promise<MailResult>) | null): void {
  transport = fn ?? send;
}
/** Children created by an adult have no real address (…@child.invalid). Never send there. */
export const sendMail = (mail: Mail): Promise<MailResult> =>
  /@[^@]+\.invalid$/i.test(mail.to.email) ? Promise.resolve({ status: 'failed', error: 'no email address for this account' }) : transport(mail);

async function send(mail: Mail): Promise<MailResult> {
  const { provider, apiKey, from, fromName, apiBase } = config.email;
  if (provider === 'log' || !apiKey) {
    const att = mail.attachments?.length ? ` [+${mail.attachments.length} attachment(s): ${mail.attachments.map((a) => a.filename).join(', ')}]` : '';
    console.log(`[mail:log] To ${mail.to.email}: ${mail.subject}${att}\n${mail.text}\n[mail:log] end`);
    return { status: 'logged' };
  }
  try {
    const res =
      provider === 'brevo'
        ? await fetch(`${apiBase ?? 'https://api.brevo.com'}/v3/smtp/email`, {
            method: 'POST',
            headers: { 'api-key': apiKey, 'content-type': 'application/json', accept: 'application/json' },
            body: JSON.stringify({
              sender: { name: fromName, email: from },
              to: [{ email: mail.to.email, ...(mail.to.name ? { name: mail.to.name } : {}) }],
              subject: mail.subject,
              htmlContent: mail.html,
              textContent: mail.text,
              ...(mail.attachments?.length ? { attachment: mail.attachments.map((a) => ({ name: a.filename, content: a.content.toString('base64') })) } : {}),
            }),
            signal: AbortSignal.timeout(15_000),
          })
        : await fetch(`${apiBase ?? 'https://api.resend.com'}/emails`, {
            method: 'POST',
            headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
            body: JSON.stringify({
              from: `${fromName} <${from}>`,
              to: [mail.to.email],
              subject: mail.subject,
              html: mail.html,
              text: mail.text,
              ...(mail.attachments?.length ? { attachments: mail.attachments.map((a) => ({ filename: a.filename, content: a.content.toString('base64') })) } : {}),
            }),
            signal: AbortSignal.timeout(15_000),
          });
    if (res.ok) return { status: 'sent' };
    const body = (await res.text()).slice(0, 300);
    console.error(`[mail] ${provider} rejected email to ${mail.to.email}: ${res.status} ${body}`);
    return { status: 'failed', error: `${res.status}` };
  } catch (e) {
    console.error(`[mail] ${provider} unreachable:`, (e as Error).message);
    return { status: 'failed', error: 'unreachable' };
  }
}

// ---------- Templates ----------

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string);

/** One simple, accessible layout for every email: readable on any phone and in plain-text clients. */
export function layout(opts: { heading: string; paragraphs: string[]; code?: string; button?: { label: string; url: string }; footer?: string }): { html: string; text: string } {
  const paras = opts.paragraphs.map((p) => `<p style="margin:0 0 14px;font-size:16px;line-height:1.5;color:#1a1d21">${esc(p)}</p>`).join('');
  const code = opts.code ? `<p style="margin:8px 0 18px;font-size:34px;letter-spacing:8px;font-weight:700;font-family:ui-monospace,Menlo,Consolas,monospace;color:#1a1d21">${esc(opts.code)}</p>` : '';
  const button = opts.button ? `<p style="margin:8px 0 18px"><a href="${esc(opts.button.url)}" style="display:inline-block;background:#1a1d21;color:#fff;text-decoration:none;font-weight:700;padding:12px 20px;border-radius:6px">${esc(opts.button.label)}</a></p>` : '';
  const footer = opts.footer ? `<p style="margin:24px 0 0;font-size:13px;line-height:1.5;color:#6b737b">${esc(opts.footer)}</p>` : '';
  const html = `<!doctype html><html><body style="margin:0;background:#eceeea;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#eceeea;padding:24px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#fff;border-radius:12px;padding:28px">
<tr><td>
<p style="margin:0 0 20px;font-size:15px;font-weight:700;color:#1a1d21"><span style="display:inline-block;border:2px solid #1a1d21;border-radius:4px;padding:0 5px;margin-right:6px">Mg</span>Umzila</p>
<h1 style="margin:0 0 16px;font-size:22px;line-height:1.3;color:#1a1d21">${esc(opts.heading)}</h1>
${paras}${code}${button}${footer}
</td></tr></table>
<p style="margin:16px 0 0;font-size:12px;color:#6b737b">Umzila, by Magubane Labs: your route from Grade 9 to a career.</p>
</td></tr></table></body></html>`;
  const text = [opts.heading, '', ...opts.paragraphs, ...(opts.code ? ['', opts.code, ''] : []), ...(opts.button ? ['', `${opts.button.label}: ${opts.button.url}`] : []), ...(opts.footer ? ['', opts.footer] : [])].join('\n');
  return { html, text };
}
