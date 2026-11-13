/* Every email the system sends, in one style, from SMTP_EMAIL.
   Links are built by the callers from FRONTEND_URL. Never logs a link or token. */
const nodemailer = require("nodemailer");

const configured = () => Boolean(process.env.SMTP_EMAIL && process.env.SMTP_PASSWORD);

let transporter = null;
function mailer() {
  if (!configured()) throw Object.assign(new Error("Email isn't configured on the server."), { code: "NO_SMTP" });
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || "smtp.gmail.com",
      port: Number(process.env.SMTP_PORT || 465),
      secure: String(process.env.SMTP_SECURE ?? "true") === "true",
      auth: { user: process.env.SMTP_EMAIL, pass: process.env.SMTP_PASSWORD },
    });
  }
  return transporter;
}

const escapeHtml = (value = "") =>
  String(value).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

const istTime = (date = new Date()) =>
  new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false }).format(date) + " IST";

/* one layout for every message: heading, paragraphs, optional button */
function layout({ heading, paragraphs, button, footnote }) {
  const body = paragraphs.map((p) => `<p style="margin:0 0 14px;color:#334155;font-size:15px;line-height:1.55">${escapeHtml(p)}</p>`).join("");
  const cta = button
    ? `<p style="margin:22px 0"><a href="${escapeHtml(button.url)}" style="display:inline-block;background:#0891b2;color:#fff;padding:13px 22px;border-radius:10px;text-decoration:none;font-weight:600">${escapeHtml(button.label)}</a></p>
       <p style="margin:0 0 14px;color:#64748b;font-size:12px;word-break:break-all">Or open: ${escapeHtml(button.url)}</p>`
    : "";
  const foot = footnote ? `<p style="margin:18px 0 0;color:#64748b;font-size:12px">${escapeHtml(footnote)}</p>` : "";
  return `<div style="font-family:Inter,Segoe UI,Arial,sans-serif;max-width:560px;margin:auto;padding:28px;background:#f8fafc;border-radius:16px">
    <p style="margin:0 0 18px;font-size:12px;letter-spacing:.16em;color:#0891b2;font-weight:700">SMART KOLKATA</p>
    <h2 style="margin:0 0 16px;color:#0f172a;font-size:20px">${escapeHtml(heading)}</h2>
    ${body}${cta}${foot}
  </div>`;
}

function text({ heading, paragraphs, button, footnote }) {
  return [heading, "", ...paragraphs, ...(button ? ["", `${button.label}: ${button.url}`] : []), ...(footnote ? ["", footnote] : []), "", "Smart Kolkata"].join("\n");
}

async function send(to, subject, parts) {
  await mailer().sendMail({
    from: `"Smart Kolkata" <${process.env.SMTP_EMAIL}>`,
    to,
    subject,
    text: text(parts),
    html: layout(parts),
  });
}

/* ---------------------------------------------------------------- staff */

const sendStaffPasswordSetupEmail = ({ name, email, setupUrl, rank }) =>
  send(email, "Your Smart Kolkata field access is approved", {
    heading: `Hello ${name},`,
    paragraphs: [
      `Command has cleared you${rank ? ` as ${rank}` : ""} on the Smart Kolkata field desk.`,
      "Create your password with the button below, then sign in on the staff desk.",
    ],
    button: { label: "Create your password", url: setupUrl },
    footnote: "The link works once and expires in 24 hours. If you didn't apply, ignore this email.",
  });

const sendStaffRejectionEmail = ({ name, email }) =>
  send(email, "Your Smart Kolkata field application", {
    heading: `Hello ${name},`,
    paragraphs: ["Thank you for applying to the Smart Kolkata field desk. Command isn't able to clear your application at this time."],
  });

/* ---------------------------------------------------------------- accounts */

const sendWelcomeEmail = (user) =>
  send(user.email, "Welcome to Smart Kolkata", {
    heading: `Welcome, ${user.name}`,
    paragraphs: ["Your citizen account is ready. Report problems in your zone and follow them until they're fixed."],
  });

const sendPasswordResetEmail = (user, resetUrl, minutes = 60) =>
  send(user.email, "Reset your Smart Kolkata password", {
    heading: `Hello ${user.name},`,
    paragraphs: ["Someone asked to reset the password for this account. If it was you, use the button below."],
    button: { label: "Choose a new password", url: resetUrl },
    footnote: `The link works once and expires in ${minutes} minutes. If you didn't ask, ignore this email: your password stays the same.`,
  });

const sendEmailChangeLink = ({ name, newEmail, url }) =>
  send(newEmail, "Confirm your new Smart Kolkata email", {
    heading: `Hello ${name},`,
    paragraphs: ["Confirm that this is the new email address for your Smart Kolkata account."],
    button: { label: "Confirm this email", url },
    footnote: "The link works once and expires in 24 hours. Until you confirm, your account keeps its current email.",
  });

const sendEmailChangedNotice = ({ name, oldEmail, newEmail }) =>
  send(oldEmail, "Your Smart Kolkata email was changed", {
    heading: `Hello ${name},`,
    paragraphs: [`Your account's email was changed to ${newEmail} at ${istTime()}.`, "Not you? Write to support at once."],
  });

const sendAdminPasswordChangedNotice = () => {
  const to = process.env.SUPPORT_EMAIL || process.env.SMTP_EMAIL;
  return send(to, "Command password changed", {
    heading: "The command password was changed",
    paragraphs: [`The command password was changed at ${istTime()}. Every device was signed out.`, "Not you? Write to support at once."],
  });
};

module.exports = {
  emailConfigured: configured,
  escapeHtml,
  sendStaffPasswordSetupEmail,
  sendStaffRejectionEmail,
  sendWelcomeEmail,
  sendPasswordResetEmail,
  sendEmailChangeLink,
  sendEmailChangedNotice,
  sendAdminPasswordChangedNotice,
};
