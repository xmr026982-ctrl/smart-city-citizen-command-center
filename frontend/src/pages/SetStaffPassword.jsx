import { useState } from 'react'

const staffEmails = [
  'alex.morgan@gmail.com',
  'jamie.lee@gmail.com',
  'taylor.rivera@gmail.com',
]

const requirements = [
  { label: 'At least 8 characters', test: (value) => value.length >= 8 },
  { label: 'One uppercase letter', test: (value) => /[A-Z]/.test(value) },
  { label: 'One lowercase letter', test: (value) => /[a-z]/.test(value) },
  { label: 'One number', test: (value) => /\d/.test(value) },
  { label: 'One special character', test: (value) => /[^A-Za-z0-9]/.test(value) },
]

function App() {
  const [step, setStep] = useState(1)
  const [staffEmail] = useState(() => staffEmails[Math.floor(Math.random() * staffEmails.length)])
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmation, setShowConfirmation] = useState(false)
  const [passwordError, setPasswordError] = useState('')
  const [confirmationError, setConfirmationError] = useState('')
  const [created, setCreated] = useState(false)

  const checks = requirements.map((requirement) => ({
    ...requirement,
    passed: requirement.test(password),
  }))
  const passwordIsValid = checks.every((check) => check.passed)

  function continueToPassword(event) {
    event.preventDefault()
    setStep(2)
  }

  function continueToConfirmation(event) {
    event.preventDefault()
    if (!passwordIsValid) {
      setPasswordError('Please meet all password requirements.')
      return
    }
    setPasswordError('')
    setStep(3)
  }

  function createPassword(event) {
    event.preventDefault()
    if (password !== confirmation) {
      setConfirmationError('Your passwords do not match.')
      return
    }
    setConfirmationError('')
    setCreated(true)
  }

  const styles = {
    page: {
      minHeight: '100vh',
      display: 'grid',
      placeItems: 'center',
      padding: '32px 20px',
      background: 'linear-gradient(145deg, #f1f7ff 0%, #f8fbff 48%, #eef7f5 100%)',
      color: '#172b4d',
      fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      boxSizing: 'border-box',
    },
    card: {
      width: '100%',
      maxWidth: '440px',
      padding: '40px',
      border: '1px solid #e7edf5',
      borderRadius: '20px',
      background: '#ffffff',
      boxShadow: '0 20px 60px rgba(35, 63, 105, 0.10)',
      boxSizing: 'border-box',
    },
    logo: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '16px', marginBottom: '30px' },
    logoMark: {
      width: '42px', height: '42px', display: 'grid', placeItems: 'center', borderRadius: '14px',
      background: 'linear-gradient(145deg, #0ea5e9 0%, #0369a1 100%)', color: '#ffffff',
      boxShadow: '0 10px 24px rgba(14, 165, 233, 0.35)', flexShrink: 0,
    },
    logoName: { fontSize: '18px', fontWeight: 750, letterSpacing: '-0.36px', lineHeight: 1 },
    logoCaption: { marginTop: '5px', color: '#7b8ba5', fontSize: '11px', letterSpacing: '1.2px', textTransform: 'uppercase' },
    progress: { margin: '0 0 24px', color: '#71809a', fontSize: '12px', textAlign: 'center' },
    title: { margin: '0 0 8px', fontSize: '28px', letterSpacing: '-0.8px' },
    intro: { margin: '0 0 26px', color: '#71809a', fontSize: '14px', lineHeight: 1.6 },
    label: { display: 'block', marginBottom: '8px', color: '#344563', fontSize: '13px', fontWeight: 650 },
    field: { marginBottom: '18px' },
    input: {
      width: '100%', height: '48px', padding: '0 14px', border: '1px solid #d9e1ec', borderRadius: '9px',
      outline: 'none', color: '#172b4d', fontSize: '14px', boxSizing: 'border-box',
    },
    passwordWrap: { position: 'relative' },
    passwordInput: { paddingRight: '76px' },
    toggle: {
      position: 'absolute', top: '50%', right: '12px', transform: 'translateY(-50%)', padding: '6px 2px',
      border: 0, background: 'transparent', color: '#1769aa', fontSize: '12px', fontWeight: 700, cursor: 'pointer',
    },
    checklist: { margin: '-2px 0 20px', padding: '15px 16px', borderRadius: '10px', background: '#f7f9fc' },
    checkTitle: { margin: '0 0 10px', color: '#52627b', fontSize: '12px', fontWeight: 700 },
    check: { display: 'flex', alignItems: 'center', gap: '9px', marginTop: '8px', color: '#7b8ba5', fontSize: '12px' },
    button: {
      width: '100%', height: '49px', border: 0, borderRadius: '9px', background: '#1769aa', color: '#ffffff',
      fontSize: '14px', fontWeight: 700, cursor: 'pointer', boxShadow: '0 8px 18px rgba(23, 105, 170, 0.2)',
    },
    navigation: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', marginTop: '20px' },
    nextButton: { width: 'auto', minWidth: '120px', height: '54px', padding: '0 28px', borderRadius: '10px', fontSize: '16px' },
    backButton: { width: 'auto', marginTop: 0, padding: '10px 0', border: 0, background: 'transparent', color: '#1769aa', fontSize: '15px', fontWeight: 650, cursor: 'pointer' },
    error: { margin: '12px 0 0', textAlign: 'center', fontSize: '13px', color: '#b42318' },
    footer: { margin: '24px 0 0', textAlign: 'center', color: '#91a0b5', fontSize: '11px' },
    overlay: {
      position: 'fixed', inset: 0, display: 'grid', placeItems: 'center', padding: '20px',
      background: 'rgba(23, 43, 77, 0.45)', zIndex: 2,
    },
    dialog: { width: '100%', maxWidth: '360px', padding: '32px', borderRadius: '18px', background: '#fff', textAlign: 'center', boxShadow: '0 20px 60px rgba(0, 0, 0, 0.2)' },
    successIcon: { width: '52px', height: '52px', margin: '0 auto 16px', display: 'grid', placeItems: 'center', borderRadius: '50%', background: '#e8f7ef', color: '#16804a', fontSize: '26px' },
  }

  return (
    <main style={styles.page}>
      <section style={styles.card} aria-labelledby="page-title">
        <div style={styles.logo} aria-label="Smart City">
          <div style={styles.logoMark} aria-hidden="true">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z" />
              <path d="M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2" />
              <path d="M10 6h4M10 10h4M10 14h4M10 18h4" />
            </svg>
          </div>
          <div>
            <div style={styles.logoName}>Smart City</div>
            <div style={styles.logoCaption}>Staff account setup</div>
          </div>
        </div>

        <p style={styles.progress}>Step {step} of 3</p>

        {step === 1 && (
          <>
            <h1 id="page-title" style={styles.title}>Staff Gmail</h1>
            <p style={styles.intro}>This Gmail address is selected for your staff account.</p>
            <form onSubmit={continueToPassword}>
              <div style={styles.field}>
                <label htmlFor="staff-email" style={styles.label}>Selected Gmail</label>
                <input id="staff-email" name="staffEmail" type="email" value={staffEmail} style={styles.input} readOnly />
              </div>
              <div style={{ ...styles.navigation, justifyContent: 'flex-end' }}>
                <button type="submit" style={{ ...styles.button, ...styles.nextButton }}>Next</button>
              </div>
            </form>
          </>
        )}

        {step === 2 && (
          <>
            <h1 id="page-title" style={styles.title}>Create password</h1>
            <p style={styles.intro}>Choose a strong password for your staff account.</p>
            <form onSubmit={continueToConfirmation}>
              <div style={styles.field}>
                <label htmlFor="password" style={styles.label}>New password</label>
                <div style={styles.passwordWrap}>
                  <input id="password" name="password" type={showPassword ? 'text' : 'password'} autoComplete="new-password" value={password} onChange={(event) => { setPassword(event.target.value); setPasswordError('') }} style={{ ...styles.input, ...styles.passwordInput }} required />
                  <button type="button" style={styles.toggle} onClick={() => setShowPassword((shown) => !shown)} aria-label={showPassword ? 'Hide password' : 'Show password'}>{showPassword ? 'Hide' : 'Show'}</button>
                </div>
              </div>
              <div style={styles.checklist}>
                <p style={styles.checkTitle}>Your password must include:</p>
                {checks.map((check) => (
                  <div key={check.label} style={{ ...styles.check, color: check.passed ? '#16804a' : '#7b8ba5' }}>
                    <span aria-hidden="true">{check.passed ? '✓' : '○'}</span>{check.label}
                  </div>
                ))}
              </div>
              <div style={styles.navigation}>
                <button type="button" style={styles.backButton} onClick={() => setStep(1)}>← Back</button>
                <button type="submit" style={{ ...styles.button, ...styles.nextButton }}>Next</button>
              </div>
              {passwordError && <p role="alert" style={styles.error}>{passwordError}</p>}
            </form>
          </>
        )}

        {step === 3 && (
          <>
            <h1 id="page-title" style={styles.title}>Confirm password</h1>
            <p style={styles.intro}>Enter your new password again to finish setting up your account.</p>
            <form onSubmit={createPassword}>
              <div style={styles.field}>
                <label htmlFor="confirmation" style={styles.label}>Confirm password</label>
                <div style={styles.passwordWrap}>
                  <input id="confirmation" name="confirmation" type={showConfirmation ? 'text' : 'password'} autoComplete="new-password" value={confirmation} onChange={(event) => { setConfirmation(event.target.value); setConfirmationError('') }} style={{ ...styles.input, ...styles.passwordInput }} required />
                  <button type="button" style={styles.toggle} onClick={() => setShowConfirmation((shown) => !shown)} aria-label={showConfirmation ? 'Hide confirmation password' : 'Show confirmation password'}>{showConfirmation ? 'Hide' : 'Show'}</button>
                </div>
              </div>
              <div style={styles.navigation}>
                <button type="button" style={styles.backButton} onClick={() => setStep(2)}>← Back</button>
                <button type="submit" style={{ ...styles.button, ...styles.nextButton }}>Create password</button>
              </div>
              {confirmationError && <p role="alert" style={styles.error}>{confirmationError}</p>}
            </form>
          </>
        )}

        <p style={styles.footer}>Your security helps keep our community connected.</p>
      </section>

      {created && (
        <div style={styles.overlay}>
          <section role="dialog" aria-modal="true" aria-labelledby="success-title" style={styles.dialog}>
            <div style={styles.successIcon} aria-hidden="true">✓</div>
            <h2 id="success-title" style={{ ...styles.title, fontSize: '22px' }}>Password created</h2>
            <p style={{ ...styles.intro, marginBottom: '22px' }}>Your password has been created successfully.</p>
            <button type="button" style={styles.button} onClick={() => setCreated(false)}>Done</button>
          </section>
        </div>
      )}
    </main>
  )
}

export default App
