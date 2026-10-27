
const nodemailer = require("nodemailer");

// =========================
// EMAIL TRANSPORTER
// =========================

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT || 587),
  secure: process.env.SMTP_SECURE === "true",
  auth: {
    user: process.env.SMTP_EMAIL,
    pass: process.env.SMTP_PASSWORD,
  },
});

// =========================
// STAFF APPROVAL EMAIL
// =========================

const sendStaffPasswordSetupEmail = async ({
  name,
  email,
  setupUrl,
}) => {
  await transporter.sendMail({
    from: `"Smart City Services" <${process.env.SMTP_EMAIL}>`,
    to: email,
    subject: "Your Smart City Staff Account Is Approved",

    text: `Hello ${name},

Your Smart City staff application has been approved.

Create your password using this link:
${setupUrl}

This link expires in 30 minutes and can only be used once.

If you did not request this account, please contact the administrator.`,

    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;padding:24px">
        <h2>Smart City Services</h2>
        <h3>Hello ${escapeHtml(name)},</h3>
        <p>Your staff application has been approved.</p>
        <p>Use the button below to create your password.</p>
        <p>
          <a href="${escapeHtml(setupUrl)}"
             style="display:inline-block;background:#1565c0;color:#fff;padding:13px 20px;border-radius:8px;text-decoration:none">
            Set Up Password
          </a>
        </p>
        <p>This link expires in 30 minutes and can only be used once.</p>
      </div>
    `,
  });
};

// =========================
// STAFF REJECTION EMAIL
// =========================

const sendStaffRejectionEmail = async ({ name, email }) => {
  await transporter.sendMail({
    from: `"Smart City Services" <${process.env.SMTP_EMAIL}>`,
    to: email,
    subject: "Update on Your Smart City Staff Application",

    text: `Hello ${name},

Thank you for your interest in joining Smart City Services.

After reviewing your application, we regret to inform you that it has not been approved at this time.

Thank you for your understanding.

Regards,
Smart City Services Team`,

    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;padding:24px;border:1px solid #e5e7eb;border-radius:12px">
        <h2 style="color:#1565c0">Smart City Services</h2>
        <h3>Hello ${escapeHtml(name)},</h3>
        <p>Thank you for your interest in joining our staff team.</p>
        <p>After reviewing your application, we regret to inform you that it has not been approved at this time.</p>
        <p>Thank you for your understanding and interest in Smart City Services.</p>
        <p>Regards,<br/>Smart City Services Team</p>
      </div>
    `,
  });
};

// =========================
// WELCOME EMAIL
// =========================

const sendWelcomeEmail = async (user) => {
  await transporter.sendMail({
    from: `"Smart City Services" <${process.env.SMTP_EMAIL}>`,
    to: user.email,
    subject: "Welcome to Smart City Services",

    text: `Hello ${user.name},

Welcome to Smart City Services. Your login was successful.

Regards,
Smart City Services Team`,

    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;padding:24px">
        <h2>Welcome to Smart City Services</h2>
        <p>Hello ${escapeHtml(user.name)},</p>
        <p>Your login was successful. Welcome to our platform.</p>
      </div>
    `,
  });
};

// =========================
// PASSWORD RESET EMAIL
// =========================

const sendPasswordResetEmail = async (user, resetUrl) => {
  await transporter.sendMail({
    from: `"Smart City Services" <${process.env.SMTP_EMAIL}>`,
    to: user.email,
    subject: "Reset Your Smart City Password",

    text: `Hello ${user.name},

We received a request to reset your Smart City Services password.

Use the link below to choose a new password:
${resetUrl}

This link expires in 15 minutes and can only be used once.

If you did not request a password reset, you can ignore this email. Your current password will remain unchanged unless the reset is completed.

Regards,
Smart City Services Team`,

    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;padding:24px;border:1px solid #e5e7eb;border-radius:12px">
        <h2 style="color:#1565c0">Smart City Services</h2>

        <p>Hello ${escapeHtml(user.name)},</p>

        <p>We received a request to reset your Smart City Services password.</p>

        <p>Click the button below to choose a new password.</p>

        <p style="margin:24px 0">
          <a href="${escapeHtml(resetUrl)}"
             style="display:inline-block;background:#1565c0;color:#ffffff;padding:13px 20px;border-radius:8px;text-decoration:none;font-weight:bold">
            Reset Password
          </a>
        </p>

        <p><strong>This link expires in 15 minutes and can only be used once.</strong></p>

        <p>If you did not request a password reset, ignore this email. Your current password will remain unchanged unless the reset is completed.</p>

        <p>Regards,<br/>Smart City Services Team</p>
      </div>
    `,
  });
};

// =========================
// ESCAPE USER-PROVIDED TEXT
// =========================

const escapeHtml = (value = "") =>
  String(value).replace(/[&<>"']/g, (character) => {
    const entities = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };

    return entities[character];
  });

// =========================
// EXPORT FUNCTIONS
// =========================

module.exports = {
  sendStaffPasswordSetupEmail,
  sendStaffRejectionEmail,
  sendWelcomeEmail,
  sendPasswordResetEmail,
};
