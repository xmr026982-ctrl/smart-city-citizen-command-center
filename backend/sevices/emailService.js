const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.SMTP_EMAIL,
    pass: process.env.SMTP_PASSWORD,
  },
});

const sendWelcomeEmail = async (user) => {
  await transporter.sendMail({
    from: `"Smart City Services" <${process.env.SMTP_EMAIL}>`,
    to: user.email,
    subject: "Welcome to Smart City Services 🌆",
    html: `
      <div style="
        font-family: Arial, sans-serif;
        max-width: 600px;
        margin: auto;
        background: #f4f8f5;
        padding: 30px;
        border-radius: 15px;
      ">

        <div style="
          background: #2e7d32;
          color: white;
          padding: 25px;
          text-align: center;
          border-radius: 15px 15px 0 0;
        ">
          <h1>🌆 Smart City</h1>
          <p>Smart Services for a Better City</p>
        </div>

        <div style="
          background: white;
          padding: 30px;
          text-align: center;
        ">

          <h2 style="color: #2e7d32;">
            Welcome, ${user.name}! 🎉
          </h2>

          <p style="font-size: 17px; color: #444;">
            Your login was successful.
          </p>

          <p style="font-size: 16px; color: #555;">
            Welcome to our Smart City Service. You can now
            access your citizen services, report civic issues,
            track your reports and stay connected with your city.
          </p>

          <div style="
            margin: 25px 0;
            padding: 15px;
            background: #e8f5e9;
            border-radius: 10px;
          ">
            <strong>Login Successful ✅</strong>
            <br>
            You are now ready to use Smart City Services.
          </div>

          <p style="color: #666;">
            Thank you for being a part of our Smart City community.
          </p>

        </div>

        <div style="
          text-align: center;
          padding: 15px;
          color: #777;
          font-size: 13px;
        ">
          © Smart City Services
        </div>

      </div>
    `,
  });
};

module.exports = {
  sendWelcomeEmail,
};