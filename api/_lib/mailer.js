// Sends email from the project Gmail over SMTP (AGENTS.md: smtp.gmail.com, port 465, app password).
import nodemailer from 'nodemailer';
import { WHY_LINE } from './texts.js';

export const gmailReady = () => Boolean(process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD);
export const gmailAuth = () => ({ user: process.env.GMAIL_USER, pass: String(process.env.GMAIL_APP_PASSWORD || '').replace(/\s+/g, '') });

// Tests swap this for a fake transport.
export const mailDeps = {
  transport: null,
  create: () => nodemailer.createTransport({ host: 'smtp.gmail.com', port: 465, secure: true, auth: gmailAuth() }),
};

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const linkify = (s) => s.replace(/https?:\/\/[^\s<]+/g, (u) => `<a href="${u}">${u}</a>`);

// The short HTML version of a plain-text email: same words, paragraphs and links.
export function toHtml(text, footer) {
  const paras = String(text).trim().split(/\n\s*\n/).map((p) => `<p style="margin:0 0 14px">${linkify(esc(p)).replace(/\n/g, '<br>')}</p>`);
  const foot = footer ? `<p style="margin:24px 0 0;color:#6b7280;font-size:12px">${esc(footer)}</p>` : '';
  return `<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.5;color:#121614">${paras.join('')}${foot}</div>`;
}

export async function sendEmail({ to, subject, text, inReplyTo, why = true }) {
  if (!gmailReady()) throw new Error('GMAIL_USER or GMAIL_APP_PASSWORD is not set');
  if (!mailDeps.transport) mailDeps.transport = mailDeps.create();
  const body = String(text).trim();
  const info = await mailDeps.transport.sendMail({
    from: { name: 'Tierscope', address: process.env.GMAIL_USER },
    to,
    subject: String(subject).replace(/[\r\n]+/g, ' ').slice(0, 150), // one line, so no extra headers can sneak in
    text: why ? `${body}\n\n--\n${WHY_LINE}\n` : `${body}\n`,
    html: toHtml(body, why ? WHY_LINE : ''),
    ...(inReplyTo ? { inReplyTo, references: [inReplyTo] } : {}),
  });
  return { messageId: info.messageId, sentAt: new Date().toISOString() };
}
