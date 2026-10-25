import { useState } from "react";
import { Building2, Eye, EyeOff, CheckCircle2, ShieldCheck } from "lucide-react";

const API_BASE_URL = (
  import.meta.env.VITE_API_URL || "http://localhost:5000"
).replace(/\/+$/, "");

export default function SetStaffPassword() {
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [step, setStep] = useState(1);
  const [created, setCreated] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [passwordError, setPasswordError] = useState("");
  const [confirmationError, setConfirmationError] = useState("");
  const [apiError, setApiError] = useState("");

  // The backend places the one-time token in the approval email link.
  const token = new URLSearchParams(window.location.search).get("token");

  const requirements = [
    {
      label: "At least 8 characters",
      valid: password.length >= 8,
    },
    {
      label: "One uppercase letter",
      valid: /[A-Z]/.test(password),
    },
    {
      label: "One lowercase letter",
      valid: /[a-z]/.test(password),
    },
    {
      label: "One number",
      valid: /[0-9]/.test(password),
    },
    {
      label: "One special character",
      valid: /[^A-Za-z0-9]/.test(password),
    },
  ];

  const passwordIsValid = requirements.every((item) => item.valid);

  function handleContinue() {
    setApiError("");
    setPasswordError("");

    if (!token) {
      setApiError(
        "Your setup link is missing its security token. Please open the complete link from your staff approval email."
      );
      return;
    }

    setStep(2);
  }

  async function handleSubmit(event) {
    event.preventDefault();

    setPasswordError("");
    setConfirmationError("");
    setApiError("");

    if (!token) {
      setApiError(
        "Your setup link is invalid or incomplete. Please use the link in your approval email."
      );
      return;
    }

    if (!passwordIsValid) {
      setPasswordError("Please meet all the password requirements below.");
      setStep(2);
      return;
    }

    if (password !== confirmation) {
      setConfirmationError("The passwords do not match.");
      return;
    }

    try {
      setSubmitting(true);

      const response = await fetch(
        `${API_BASE_URL}/api/staff-requests/set-password`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            token,
            password,
          }),
        }
      );

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          data.message ||
            "Unable to create your password. Your setup link may have expired."
        );
      }

      // Show success only after the backend confirms account creation.
      setCreated(true);
    } catch (error) {
      setApiError(
        error.message ||
          "Could not connect to the server. Please try again."
      );
    } finally {
      setSubmitting(false);
    }
  }

  const styles = {
    page: {
      minHeight: "100vh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "28px 16px",
      boxSizing: "border-box",
      background:
        "radial-gradient(circle at top left, #182d50 0%, #0b1220 45%, #070b13 100%)",
      color: "#e8edf7",
      fontFamily:
        "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif",
    },
    card: {
      width: "100%",
      maxWidth: "450px",
      padding: "34px",
      boxSizing: "border-box",
      background: "rgba(16, 25, 42, 0.96)",
      border: "1px solid #29374d",
      borderRadius: "22px",
      boxShadow: "0 24px 70px rgba(0,0,0,0.35)",
    },
    logo: {
      width: "52px",
      height: "52px",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      borderRadius: "16px",
      background: "linear-gradient(135deg, #3985ff, #6855e8)",
      color: "#fff",
      marginBottom: "22px",
    },
    heading: {
      fontSize: "25px",
      fontWeight: 750,
      letterSpacing: "-0.7px",
      margin: "0 0 10px",
    },
    description: {
      color: "#9caec6",
      fontSize: "14px",
      lineHeight: 1.7,
      margin: "0 0 24px",
    },
    label: {
      display: "block",
      fontSize: "13px",
      fontWeight: 650,
      color: "#dbe5f5",
      marginBottom: "9px",
    },
    inputWrap: {
      position: "relative",
      marginBottom: "18px",
    },
    input: {
      width: "100%",
      height: "48px",
      padding: "0 45px 0 14px",
      boxSizing: "border-box",
      background: "#0b1423",
      border: "1px solid #34435b",
      borderRadius: "11px",
      outline: "none",
      color: "#f3f6fc",
      fontSize: "14px",
    },
    eyeButton: {
      position: "absolute",
      right: "12px",
      top: "50%",
      transform: "translateY(-50%)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      border: "none",
      background: "transparent",
      color: "#9caec6",
      cursor: "pointer",
      padding: "4px",
    },
    primaryButton: {
      width: "100%",
      minHeight: "48px",
      border: "none",
      borderRadius: "11px",
      background: "linear-gradient(100deg, #347eff, #6257e8)",
      color: "#fff",
      fontSize: "14px",
      fontWeight: 700,
      cursor: "pointer",
      marginTop: "8px",
    },
    disabledButton: {
      opacity: 0.6,
      cursor: "not-allowed",
    },
    requirements: {
      background: "#0c1728",
      border: "1px solid #263750",
      borderRadius: "12px",
      padding: "15px",
      margin: "0 0 20px",
    },
    requirement: {
      display: "flex",
      alignItems: "center",
      gap: "9px",
      fontSize: "12px",
      margin: "9px 0",
    },
    error: {
      color: "#ff9caa",
      background: "rgba(220, 53, 69, 0.10)",
      border: "1px solid rgba(255, 100, 120, 0.25)",
      borderRadius: "10px",
      padding: "11px 12px",
      fontSize: "12px",
      lineHeight: 1.6,
      margin: "0 0 16px",
      overflowWrap: "anywhere",
    },
    footer: {
      marginTop: "22px",
      paddingTop: "17px",
      borderTop: "1px solid #27364b",
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
      gap: "7px",
      color: "#8092aa",
      fontSize: "11px",
    },
    successIcon: {
      width: "68px",
      height: "68px",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      borderRadius: "50%",
      background: "rgba(40, 200, 130, 0.12)",
      color: "#49d99a",
      marginBottom: "22px",
    },
    stepRow: {
      display: "flex",
      alignItems: "center",
      gap: "8px",
      marginBottom: "24px",
    },
    stepDot: {
      height: "5px",
      flex: 1,
      borderRadius: "8px",
      background: "#2c3b52",
    },
  };

  return (
    <main style={styles.page}>
      <section style={styles.card}>
        <div style={styles.logo}>
          <Building2 size={29} strokeWidth={2.2} />
        </div>

        {created ? (
          <>
            <div style={styles.successIcon}>
              <CheckCircle2 size={39} />
            </div>

            <h1 style={styles.heading}>Password created!</h1>

            <p style={styles.description}>
              Your staff account has been set up successfully. You can now
              return to Smart City and sign in using your staff email and new
              password.
            </p>

            <button
              type="button"
              style={styles.primaryButton}
              onClick={() => {
                window.location.href = "/?page=auth";
              }}
            >
              Continue to Smart City
            </button>
          </>
        ) : (
          <>
            <div style={styles.stepRow}>
              {[1, 2].map((item) => (
                <div
                  key={item}
                  style={{
                    ...styles.stepDot,
                    background: step >= item ? "#4a83ff" : "#2c3b52",
                  }}
                />
              ))}
            </div>

            {step === 1 ? (
              <>
                <h1 style={styles.heading}>Set up your staff account</h1>

                <p style={styles.description}>
                  Your staff request has been approved. Create a secure
                  password to finish setting up your account.
                </p>

                {apiError && (
                  <p role="alert" style={styles.error}>
                    {apiError}
                  </p>
                )}

                <button
                  type="button"
                  style={styles.primaryButton}
                  onClick={handleContinue}
                >
                  Continue
                </button>
              </>
            ) : (
              <>
                <h1 style={styles.heading}>Create your password</h1>

                <p style={styles.description}>
                  Choose a strong password for your Smart City staff account.
                </p>

                {apiError && (
                  <p role="alert" style={styles.error}>
                    {apiError}
                  </p>
                )}

                <form onSubmit={handleSubmit}>
                  <label htmlFor="staff-password" style={styles.label}>
                    New password
                  </label>

                  <div style={styles.inputWrap}>
                    <input
                      id="staff-password"
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(event) => {
                        setPassword(event.target.value);
                        setPasswordError("");
                      }}
                      placeholder="Create a strong password"
                      autoComplete="new-password"
                      required
                      style={styles.input}
                    />

                    <button
                      type="button"
                      aria-label={
                        showPassword ? "Hide password" : "Show password"
                      }
                      onClick={() => setShowPassword((value) => !value)}
                      style={styles.eyeButton}
                    >
                      {showPassword ? (
                        <EyeOff size={18} />
                      ) : (
                        <Eye size={18} />
                      )}
                    </button>
                  </div>

                  <div style={styles.requirements}>
                    <p
                      style={{
                        fontSize: "12px",
                        fontWeight: 700,
                        color: "#dbe5f5",
                        margin: "0 0 12px",
                      }}
                    >
                      Password requirements
                    </p>

                    {requirements.map((item) => (
                      <div
                        key={item.label}
                        style={{
                          ...styles.requirement,
                          color: item.valid ? "#49d99a" : "#9caec6",
                        }}
                      >
                        <CheckCircle2 size={15} />
                        <span>{item.label}</span>
                      </div>
                    ))}
                  </div>

                  {passwordError && (
                    <p role="alert" style={styles.error}>
                      {passwordError}
                    </p>
                  )}

                  <label htmlFor="staff-confirm-password" style={styles.label}>
                    Confirm password
                  </label>

                  <div style={styles.inputWrap}>
                    <input
                      id="staff-confirm-password"
                      type={showConfirmation ? "text" : "password"}
                      value={confirmation}
                      onChange={(event) => {
                        setConfirmation(event.target.value);
                        setConfirmationError("");
                      }}
                      placeholder="Enter your password again"
                      autoComplete="new-password"
                      required
                      style={styles.input}
                    />

                    <button
                      type="button"
                      aria-label={
                        showConfirmation
                          ? "Hide confirmation password"
                          : "Show confirmation password"
                      }
                      onClick={() =>
                        setShowConfirmation((value) => !value)
                      }
                      style={styles.eyeButton}
                    >
                      {showConfirmation ? (
                        <EyeOff size={18} />
                      ) : (
                        <Eye size={18} />
                      )}
                    </button>
                  </div>

                  {confirmationError && (
                    <p role="alert" style={styles.error}>
                      {confirmationError}
                    </p>
                  )}

                  <button
                    type="submit"
                    disabled={submitting}
                    style={{
                      ...styles.primaryButton,
                      ...(submitting ? styles.disabledButton : {}),
                    }}
                  >
                    {submitting ? "Creating password..." : "Create Password"}
                  </button>

                  <button
                    type="button"
                    disabled={submitting}
                    onClick={() => {
                      setStep(1);
                      setApiError("");
                      setPasswordError("");
                      setConfirmationError("");
                    }}
                    style={{
                      ...styles.primaryButton,
                      background: "transparent",
                      border: "1px solid #34435b",
                      color: "#c8d5e8",
                      marginTop: "12px",
                    }}
                  >
                    Back
                  </button>
                </form>
              </>
            )}
          </>
        )}

        <div style={styles.footer}>
          <ShieldCheck size={14} />
          <span>Smart City · Secure Staff Account Setup</span>
        </div>
      </section>
    </main>
  );
}
