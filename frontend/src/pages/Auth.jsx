
import { useState } from 'react'
import { Building2 } from 'lucide-react'
import {
  GoogleAuthProvider,
  signInWithPopup,
} from 'firebase/auth'
import { auth } from '../firebase'

const API_URL = (
  import.meta.env.VITE_API_URL || 'http://127.0.0.1:5000/api'
).replace(/\/+$/, '')

const CITIZEN_ZONES = [
  'Shyambazar',
  'B.B.D. Bagh',
  'Ballygunge',
  'College Street',
  'B.P. Township',
  'Dharmatala',
]

const roles = [
  {
    id: 'admin',
    name: 'Admin',
    description: 'Manage city operations',
    icon: '⚙️',
  },
  {
    id: 'staff',
    name: 'Staff',
    description: 'Access staff services',
    icon: '🧑‍💼',
  },
  {
    id: 'user',
    name: 'Citizen',
    description: 'Access smart city services',
    icon: '👤',
  },
]

const staffExperiences = [
  'Field Active',
  '2 Years',
  '5 Years',
  '10 Years',
  'Senior Field',
]

const staffExpertise = [
  'Electrical',
  'Roads',
  'Waste',
  'Water',
  'Civic',
]

const emptyStaffDetails = {
  name: '',
  email: '',
  experience: '',
  workArea: '',
  zone: '',
  note: '',
}

// =====================================
// REUSABLE COMPONENTS
// =====================================

function RequiredMark() {
  return (
    <span
      className="required-mark"
      style={{ color: '#ef4444', fontWeight: 700 }}
      aria-label="required"
    >
      *
    </span>
  )
}

function CityMark({ role }) {
  const serviceLabel =
    role === 'admin'
      ? 'ADMIN'
      : role === 'staff'
        ? 'STAFF'
        : role === 'user' || role === 'citizen'
          ? 'CITIZEN'
          : null

  return (
    <div className="brand-lockup">
      <div className="brand-mark" aria-hidden="true">
        <Building2 size={26} strokeWidth={1.8} />
      </div>

      <div className="brand-copy">
        <strong>Smart City</strong>
        {serviceLabel && <span>{serviceLabel}</span>}
      </div>
    </div>
  )
}

function GoogleButton({ onClick, disabled }) {
  return (
    <button
      type="button"
      className="google-button"
      onClick={onClick}
      disabled={disabled}
    >
      <svg
        className="google-icon"
        viewBox="0 0 18 18"
        aria-hidden="true"
      >
        <path
          fill="#4285F4"
          d="M17.6 9.2c0-.6-.1-1.2-.2-1.8H9v3.4h4.8a4.1 4.1 0 0 1-1.8 2.7v2.2h2.9c1.7-1.6 2.7-3.9 2.7-6.5z"
        />
        <path
          fill="#34A853"
          d="M9 18c2.4 0 4.5-.8 6-2.2l-2.9-2.2c-.8.6-1.9.9-3.1.9-2.4 0-4.4-1.6-5.1-3.8H.9v2.3A9 9 0 0 0 9 18z"
        />
        <path
          fill="#FBBC05"
          d="M3.9 10.7a5.4 5.4 0 0 1 0-3.4V5H.9a9 9 0 0 0 0 8l3-2.3z"
        />
        <path
          fill="#EA4335"
          d="M9 3.6c1.3 0 2.5.5 3.4 1.3L15 2.3A9 9 0 0 0 .9 5l3 2.3C4.6 5.2 6.6 3.6 9 3.6z"
        />
      </svg>

      <span>
        {disabled ? 'Connecting to Google...' : 'Continue with Google'}
      </span>
    </button>
  )
}

function AuthFooter() {
  return <footer className="auth-footer">© 2026 Smart City</footer>
}

function CitizenZoneSelect({
  value,
  onChange,
  id = 'citizen-zone',
}) {
  return (
    <>
      <label htmlFor={id}>
        Select Your Zone <RequiredMark />
      </label>

      <select
        id={id}
        className="field"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        required
      >
        <option value="">Choose your city zone</option>

        {CITIZEN_ZONES.map((zone) => (
          <option key={zone} value={zone}>
            {zone}
          </option>
        ))}
      </select>

      <small className="zone-help">
        Select the approved zone where you live or use Smart City services.
      </small>
    </>
  )
}

// =====================================
// MAIN AUTH COMPONENT
// =====================================

export default function Auth() {
  const [mode, setMode] = useState('login')
  const [step, setStep] = useState('role')
  const [role, setRole] = useState(null)

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [passwordStep, setPasswordStep] = useState(false)

  const [citizenZone, setCitizenZone] = useState('')
  const [requiresZoneForLogin, setRequiresZoneForLogin] =
    useState(false)
  const [pendingGoogleToken, setPendingGoogleToken] = useState('')

  const [submitting, setSubmitting] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [forgotLoading, setForgotLoading] = useState(false)
  const [staffSubmitting, setStaffSubmitting] = useState(false)

  const [message, setMessage] = useState('')
  const [messageType, setMessageType] = useState('error')

  const [staffRequestSubmitted, setStaffRequestSubmitted] =
    useState(false)

  const [staffDetails, setStaffDetails] = useState({
    ...emptyStaffDetails,
  })

  const selectedRole = roles.find((item) => item.id === role)
  const citizenLogin = mode === 'login' && role === 'user'

  const showPasswordField =
    mode === 'signup' || !citizenLogin || passwordStep

  // =====================================
  // HELPERS
  // =====================================

  function showStatus(text, type = 'error') {
    setMessage(text)
    setMessageType(type)
  }

  function resetCitizenZoneFlow() {
    setCitizenZone('')
    setRequiresZoneForLogin(false)
    setPendingGoogleToken('')
  }

  function switchMode(nextMode) {
    setMode(nextMode)
    setStep(nextMode === 'login' ? 'role' : 'credentials')
    setRole(null)

    setName('')
    setEmail('')
    setPassword('')

    setShowPassword(false)
    setPasswordStep(false)

    resetCitizenZoneFlow()

    setMessage('')
    setMessageType('error')
    setStaffRequestSubmitted(false)
  }

  function selectRole(nextRole) {
    setRole(nextRole)
    setStep('credentials')

    setEmail('')
    setPassword('')

    setPasswordStep(false)
    setShowPassword(false)

    resetCitizenZoneFlow()
    setMessage('')
  }

  function saveSession(data) {
    if (!data?.token || !data?.user) {
      throw new Error(
        'The server did not return a valid login session.'
      )
    }

    localStorage.setItem('token', data.token)
    localStorage.setItem('user', JSON.stringify(data.user))
  }

  async function postAuth(path, body) {
    const response = await fetch(`${API_URL}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })

    const data = await response.json().catch(() => ({}))

    if (!response.ok) {
      throw new Error(data.message || 'Request failed.')
    }

    return data
  }

  // =====================================
  // EMAIL / PASSWORD LOGIN AND REGISTER
  // =====================================

  async function submit(event) {
    event.preventDefault()

    if (submitting) return

    setMessage('')

    // First step of citizen login: collect email.
    if (citizenLogin && !passwordStep) {
      if (!email.trim()) {
        showStatus('Please enter your email address.')
        return
      }

      setPasswordStep(true)
      return
    }

    if (mode === 'signup') {
      if (!name.trim()) {
        showStatus('Please enter your full name.')
        return
      }

      if (!CITIZEN_ZONES.includes(citizenZone)) {
        showStatus('Please select a valid city zone.')
        return
      }
    }

    // Do not attempt citizen login without a zone once requested.
    if (
      citizenLogin &&
      requiresZoneForLogin &&
      !CITIZEN_ZONES.includes(citizenZone)
    ) {
      showStatus('Please select a valid city zone.')
      return
    }

    setSubmitting(true)

    try {
      if (mode === 'login') {
        const requestBody = {
          email: email.trim().toLowerCase(),
          password,
          role,
        }

        // Always include the selected zone for citizen login
        // when a zone has been selected.
        if (citizenLogin && citizenZone) {
          requestBody.zone = citizenZone
        }

        const data = await postAuth('/auth/login', requestBody)

        // Legacy citizen account needs a zone.
        if (data.requiresZone && citizenLogin) {
          setRequiresZoneForLogin(true)
          setCitizenZone('')

          showStatus(
            'Your account needs a zone. Select your zone below, then click SIGN IN again.'
          )
          return
        }

        const expectedRole = role === 'user' ? 'citizen' : role

        if (data.user?.role !== expectedRole) {
          throw new Error(
            'The server returned an unexpected account role.'
          )
        }

        if (
          expectedRole === 'citizen' &&
          !CITIZEN_ZONES.includes(data.user?.zone)
        ) {
          throw new Error(
            'The server returned an invalid citizen zone. Please check your account zone and try again.'
          )
        }

        saveSession(data)

        showStatus(
          `${selectedRole?.name || 'User'} login successful!`,
          'success'
        )

        resetCitizenZoneFlow()
      } else {
        const data = await postAuth('/auth/register', {
          name: name.trim(),
          email: email.trim().toLowerCase(),
          password,
          zone: citizenZone,
        })

        if (data.user?.role && data.user.role !== 'citizen') {
          throw new Error('Unexpected account role returned by server.')
        }

        if (!CITIZEN_ZONES.includes(data.user?.zone)) {
          throw new Error(
            'Registration succeeded without a valid saved zone. Please contact support.'
          )
        }

        saveSession(data)

        showStatus(
          'Citizen account created successfully!',
          'success'
        )

        resetCitizenZoneFlow()
      }
    } catch (error) {
      console.error('Authentication error:', error.message)
      showStatus(error.message || 'Authentication failed.')
    } finally {
      setSubmitting(false)
    }
  }

  // =====================================
  // GOOGLE SIGN-IN
  // =====================================

  async function handleGoogleLogin() {
    if (googleLoading) return

    setMessage('')
    setGoogleLoading(true)

    try {
      const provider = new GoogleAuthProvider()

      provider.setCustomParameters({
        prompt: 'select_account',
      })

      const result = await signInWithPopup(auth, provider)
      const idToken = await result.user.getIdToken()

      const data = await postAuth('/auth/google', { idToken })

      if (data.requiresZone) {
        setPendingGoogleToken(idToken)
        setEmail(data.email || result.user.email || '')
        setCitizenZone('')

        showStatus(
          'Google account verified. Select your zone to continue.',
          'success'
        )
        return
      }

      if (data.user?.role !== 'citizen') {
        throw new Error(
          'Google sign-in is available for citizen accounts only.'
        )
      }

      if (!CITIZEN_ZONES.includes(data.user?.zone)) {
        setPendingGoogleToken(idToken)
        setEmail(data.user?.email || result.user.email || '')
        setCitizenZone('')

        showStatus(
          'Select your city zone to finish Google sign-in.',
          'success'
        )
        return
      }

      saveSession(data)
      setEmail(data.user.email || result.user.email || '')
      setCitizenZone(data.user.zone)

      showStatus('Google sign-in successful!', 'success')
    } catch (error) {
      console.error(
        'Google sign-in error:',
        error.code || error.message
      )

      if (error.code === 'auth/popup-closed-by-user') {
        showStatus('Google sign-in was cancelled.')
      } else if (error.code === 'auth/unauthorized-domain') {
        showStatus(
          'This website is not authorized in Firebase. Add its domain to Firebase Authorized domains.'
        )
      } else if (error.code === 'auth/popup-blocked') {
        showStatus(
          'Your browser blocked the popup. Allow popups and try again.'
        )
      } else {
        showStatus(error.message || 'Google sign-in failed.')
      }
    } finally {
      setGoogleLoading(false)
    }
  }

  // =====================================
  // COMPLETE GOOGLE LOGIN AFTER ZONE
  // =====================================

  async function completeGoogleLogin() {
    if (googleLoading) return

    if (!pendingGoogleToken) {
      showStatus('Please start Google sign-in again.')
      return
    }

    if (!CITIZEN_ZONES.includes(citizenZone)) {
      showStatus('Please select a valid city zone.')
      return
    }

    setGoogleLoading(true)
    setMessage('')

    try {
      const data = await postAuth('/auth/google', {
        idToken: pendingGoogleToken,
        zone: citizenZone,
      })

      if (data.requiresZone || !data.token || !data.user) {
        throw new Error(
          'The server has not completed your login. Please try again.'
        )
      }

      if (
        data.user.role !== 'citizen' ||
        data.user.zone !== citizenZone ||
        !CITIZEN_ZONES.includes(data.user.zone)
      ) {
        throw new Error(
          'The selected zone could not be verified. Please try again.'
        )
      }

      saveSession(data)

      setEmail(data.user.email || email)
      setPendingGoogleToken('')
      setRequiresZoneForLogin(false)

      showStatus('Google sign-in successful!', 'success')
    } catch (error) {
      console.error('Google zone completion error:', error.message)
      showStatus(error.message || 'Unable to complete Google sign-in.')
    } finally {
      setGoogleLoading(false)
    }
  }

  // =====================================
  // FORGOT PASSWORD
  // =====================================

  async function handleForgotPassword() {
    if (forgotLoading) return

    const normalizedEmail = email.trim().toLowerCase()

    if (!normalizedEmail) {
      showStatus('Please enter your email address first.')
      return
    }

    setForgotLoading(true)
    setMessage('')

    try {
      const data = await postAuth('/auth/forgot-password', {
        email: normalizedEmail,
      })

      showStatus(
        data.message ||
          'If an account exists for that email, a reset link will be sent.',
        'success'
      )
    } catch (error) {
      console.error('Forgot-password error:', error.message)
      showStatus(
        error.message || 'Unable to process your password reset request.'
      )
    } finally {
      setForgotLoading(false)
    }
  }

  // =====================================
  // STAFF APPLICATION
  // =====================================

  function handleStaffDetailsChange(event) {
    const { name: fieldName, value } = event.target

    setStaffDetails((previous) => ({
      ...previous,
      [fieldName]: value,
    }))

    setMessage('')
  }

  async function submitStaffDetails(event) {
    event.preventDefault()

    if (staffSubmitting) return

    setMessage('')

    const staffName = staffDetails.name.trim()
    const staffEmail = staffDetails.email.trim().toLowerCase()
    const experience = staffDetails.experience
    const expertise = staffDetails.workArea
    const zone = staffDetails.zone
    const note = staffDetails.note.trim()

    if (!staffName || !staffEmail || !experience || !expertise || !zone) {
      showStatus('Please fill in all required staff application fields.')
      return
    }

    setStaffSubmitting(true)

    try {
      const response = await fetch(`${API_URL}/staff-requests`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: staffName,
          email: staffEmail,
          Experience: experience,
          Expertise: expertise,
          zone,
          note,
        }),
      })

      const data = await response.json().catch(() => ({}))

      if (!response.ok) {
        throw new Error(
          data.message || 'Could not submit your staff application.'
        )
      }

      setStaffDetails({
        ...emptyStaffDetails,
        name: staffName,
        email: staffEmail,
        experience,
        workArea: expertise,
        zone,
        note,
      })

      setStaffRequestSubmitted(true)
      showStatus('', 'success')
    } catch (error) {
      console.error('Staff application error:', error.message)
      showStatus(
        error.message || 'Unable to connect to the server. Please try again.'
      )
    } finally {
      setStaffSubmitting(false)
    }
  }

  function resetStaffRequest() {
    setStaffDetails({ ...emptyStaffDetails })
    setStaffRequestSubmitted(false)
    setStaffSubmitting(false)
    setMessage('')
  }

  function returnToStaffLogin() {
    resetStaffRequest()

    setStep('credentials')
    setRole('staff')
    setMode('login')

    setEmail('')
    setPassword('')
    setPasswordStep(false)
    setShowPassword(false)

    resetCitizenZoneFlow()
  }

  // =====================================
  // ROLE SELECTION SCREEN
  // =====================================

  if (mode === 'login' && step === 'role') {
    return (
      <>
        <main className="auth-page">
          <div className="ambient ambient-one" aria-hidden="true" />
          <div className="ambient ambient-two" aria-hidden="true" />
          <div className="city-silhouette" aria-hidden="true" />

          <section className="auth-card role-selection-card">
            <CityMark />

            <h1>Login to Smart City</h1>
            <p className="intro">Choose your login type to continue.</p>

            <div className="role-options">
              {roles.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className="role-card"
                  onClick={() => selectRole(item.id)}
                >
                  <span className="role-icon">{item.icon}</span>

                  <span className="role-copy">
                    <strong>{item.name} Login</strong>
                    <small>{item.description}</small>
                  </span>

                  <span className="role-arrow" aria-hidden="true">
                    →
                  </span>
                </button>
              ))}
            </div>

            <p className="switch-copy">
              Don't have an account?{' '}
              <button
                className="text-button"
                type="button"
                onClick={() => switchMode('signup')}
              >
                Create account
              </button>
            </p>
          </section>
        </main>

        <AuthFooter />
      </>
    )
  }

  // =====================================
  // STAFF APPLICATION SCREEN
  // =====================================

  if (mode === 'login' && step === 'staff-details') {
    return (
      <>
        <main className="auth-page">
          <div className="ambient ambient-one" aria-hidden="true" />
          <div className="ambient ambient-two" aria-hidden="true" />
          <div className="city-silhouette" aria-hidden="true" />

          <section
            className="auth-card staff-card"
            style={{ maxWidth: '520px', width: '100%' }}
          >
            {!staffRequestSubmitted && (
              <button
                className="back-button"
                type="button"
                disabled={staffSubmitting}
                onClick={() => {
                  setStep('credentials')
                  setMessage('')
                }}
              >
                <span aria-hidden="true">←</span> BACK TO STAFF LOGIN
              </button>
            )}

            <CityMark role="staff" />

            {staffRequestSubmitted ? (
              <div className="staff-request-success">
                <div className="success-icon" aria-hidden="true">✓</div>

                <h1>Request Submitted Successfully!</h1>

                <p className="success-description">
                  Thank you, {staffDetails.name}. Your staff application
                  has been submitted successfully.
                </p>

                <div className="success-details">
                  <p>
                    <strong>Status:</strong>{' '}
                    <span className="pending-badge">
                      Pending Approval
                    </span>
                  </p>

                  <p><strong>Email:</strong> {staffDetails.email}</p>
                  <p><strong>Experience:</strong> {staffDetails.experience}</p>
                  <p><strong>Expertise:</strong> {staffDetails.workArea}</p>
                  <p><strong>Zone:</strong> {staffDetails.zone}</p>
                </div>

                <p className="success-note">
                  Your application is awaiting administrator review.
                  If approved, you will receive an email with instructions
                  to set up your staff password.
                </p>

                <button
                  type="button"
                  className="submit-button"
                  onClick={returnToStaffLogin}
                >
                  RETURN TO STAFF LOGIN
                </button>
              </div>
            ) : (
              <>
                <h1>Staff Request</h1>
                <p className="intro">
                  Provide your staff information for Smart City.
                </p>

                <form onSubmit={submitStaffDetails}>
                  <label htmlFor="staff-name">
                    Full Name <RequiredMark />
                  </label>

                  <input
                    id="staff-name"
                    className="field"
                    type="text"
                    name="name"
                    placeholder="Enter your full name"
                    value={staffDetails.name}
                    onChange={handleStaffDetailsChange}
                    autoComplete="name"
                    required
                  />

                  <label htmlFor="staff-email" className="staff-field-label">
                    Staff Email Address <RequiredMark />
                  </label>

                  <input
                    id="staff-email"
                    className="field"
                    type="email"
                    name="email"
                    placeholder="Enter your official email"
                    value={staffDetails.email}
                    onChange={handleStaffDetailsChange}
                    autoComplete="email"
                    required
                  />

                  <label htmlFor="staff-experience" className="staff-field-label">
                    Experience <RequiredMark />
                  </label>

                  <select
                    id="staff-experience"
                    className="field"
                    name="experience"
                    value={staffDetails.experience}
                    onChange={handleStaffDetailsChange}
                    required
                  >
                    <option value="">Select your experience</option>
                    {staffExperiences.map((item) => (
                      <option key={item} value={item}>{item}</option>
                    ))}
                  </select>

                  <label htmlFor="staff-expertise" className="staff-field-label">
                    Staff Expertise <RequiredMark />
                  </label>

                  <select
                    id="staff-expertise"
                    className="field"
                    name="workArea"
                    value={staffDetails.workArea}
                    onChange={handleStaffDetailsChange}
                    required
                  >
                    <option value="">Select your expertise</option>
                    {staffExpertise.map((item) => (
                      <option key={item} value={item}>{item}</option>
                    ))}
                  </select>

                  <label htmlFor="staff-zone" className="staff-field-label">
                    Zone <RequiredMark />
                  </label>

                  <select
                    id="staff-zone"
                    className="field"
                    name="zone"
                    value={staffDetails.zone}
                    onChange={handleStaffDetailsChange}
                    required
                  >
                    <option value="">Select your zone</option>
                    {CITIZEN_ZONES.map((item) => (
                      <option key={item} value={item}>{item}</option>
                    ))}
                  </select>

                  <label htmlFor="staff-note" className="staff-field-label">
                    Short Note About Your Request (Optional)
                  </label>

                  <textarea
                    id="staff-note"
                    className="field"
                    name="note"
                    placeholder="Briefly explain your staff request (optional)"
                    value={staffDetails.note}
                    onChange={handleStaffDetailsChange}
                    rows={3}
                  />

                  <button
                    className="submit-button"
                    type="submit"
                    style={{ marginTop: '22px' }}
                    disabled={staffSubmitting}
                  >
                    {staffSubmitting ? 'SUBMITTING REQUEST...' : 'SUBMIT REQUEST'}
                  </button>
                </form>

                {message && (
                  <p
                    className={`status-message ${
                      messageType === 'success' ? 'success-message' : ''
                    }`}
                    role="status"
                    aria-live="polite"
                  >
                    {message}
                  </p>
                )}
              </>
            )}
          </section>
        </main>

        <AuthFooter />
      </>
    )
  }

  // =====================================
  // LOGIN / SIGNUP SCREEN
  // =====================================

  return (
    <>
      <main className="auth-page">
        <div className="ambient ambient-one" aria-hidden="true" />
        <div className="ambient ambient-two" aria-hidden="true" />
        <div className="city-silhouette" aria-hidden="true" />

        <section
          className={`auth-card ${
            role === 'admin'
              ? 'admin-card'
              : role === 'staff'
                ? 'staff-card'
                : ''
          }`}
        >
          {mode === 'login' && (
            <button
              className="back-button"
              type="button"
              onClick={() => {
                setStep('role')
                setRole(null)
                setEmail('')
                setPassword('')
                setMessage('')
                setPasswordStep(false)
                setShowPassword(false)
                resetCitizenZoneFlow()
              }}
            >
              <span aria-hidden="true">←</span> ROLES
            </button>
          )}

          <CityMark role={mode === 'login' ? role : null} />

          <h1>
            {mode === 'signup'
              ? 'Create Citizen Account'
              : role === 'admin'
                ? 'Admin Login'
                : role === 'staff'
                  ? 'Staff Login'
                  : role === 'user'
                    ? 'Citizen Login'
                    : 'Sign in'}
          </h1>

          {mode === 'signup' && (
            <p className="intro">
              Create your account to access smart city services.
            </p>
          )}

          {citizenLogin && (
            <p className="intro">
              Sign in to access your city services.
            </p>
          )}

          {(mode === 'signup' || citizenLogin) && (
            <>
              {!pendingGoogleToken && (
                <>
                  <GoogleButton
                    onClick={handleGoogleLogin}
                    disabled={googleLoading}
                  />

                  <div className="divider"><span>or</span></div>
                </>
              )}

              {pendingGoogleToken && (
                <div className="google-zone-step">
                  <p className="intro">
                    Google account verified. Select your zone to continue.
                  </p>

                  <CitizenZoneSelect
                    id="google-citizen-zone"
                    value={citizenZone}
                    onChange={setCitizenZone}
                  />

                  <button
                    type="button"
                    className="submit-button"
                    style={{ marginTop: '16px' }}
                    onClick={completeGoogleLogin}
                    disabled={googleLoading || !citizenZone}
                  >
                    {googleLoading
                      ? 'PLEASE WAIT...'
                      : 'CONTINUE WITH SELECTED ZONE'}
                  </button>

                  <button
                    type="button"
                    className="text-button"
                    style={{ marginTop: '12px' }}
                    disabled={googleLoading}
                    onClick={() => {
                      setPendingGoogleToken('')
                      setCitizenZone('')
                      setMessage('')
                    }}
                  >
                    Cancel Google sign-in
                  </button>
                </div>
              )}
            </>
          )}

          {!pendingGoogleToken && (
            <form onSubmit={submit}>
              {mode === 'signup' && (
                <>
                  <label htmlFor="full-name">
                    Full name <RequiredMark />
                  </label>

                  <input
                    id="full-name"
                    className="field"
                    type="text"
                    placeholder="Enter your full name"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    autoComplete="name"
                    required
                  />
                </>
              )}

              <label htmlFor="identity">
                {role === 'staff' && mode === 'login'
                  ? 'Staff Email Address'
                  : role === 'admin' && mode === 'login'
                    ? 'Admin Email Address'
                    : 'Email address'}
              </label>

              <input
                id="identity"
                className="field"
                type="email"
                placeholder={
                  role === 'staff' && mode === 'login'
                    ? 'Enter your registered staff email'
                    : role === 'admin' && mode === 'login'
                      ? 'Enter your admin email'
                      : 'name@email.com'
                }
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                autoComplete="email"
                required
              />

              {mode === 'signup' && (
                <CitizenZoneSelect
                  value={citizenZone}
                  onChange={setCitizenZone}
                />
              )}

              {citizenLogin && requiresZoneForLogin && (
                <div className="login-zone-step">
                  <p className="intro">
                    Your account needs a zone before you can continue.
                    Select a zone below, then sign in again.
                  </p>

                  <CitizenZoneSelect
                    id="login-citizen-zone"
                    value={citizenZone}
                    onChange={setCitizenZone}
                  />
                </div>
              )}

              {showPasswordField && (
                <>
                  <div className="password-label">
                    <label htmlFor="password">Password</label>

                    {mode === 'login' && (
                      <button
                        type="button"
                        className="text-button"
                        disabled={forgotLoading}
                        onClick={handleForgotPassword}
                      >
                        {forgotLoading ? 'Sending...' : 'Forgot password?'}
                      </button>
                    )}
                  </div>

                  <div className="password-input-wrap">
                    <input
                      id="password"
                      className="field"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="Enter your password"
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      autoComplete={
                        mode === 'login'
                          ? 'current-password'
                          : 'new-password'
                      }
                      required
                    />

                    <button
                      type="button"
                      className="password-toggle"
                      onClick={() => setShowPassword((visible) => !visible)}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? 'Hide' : 'Show'}
                    </button>
                  </div>
                </>
              )}

              <button
                className="submit-button"
                type="submit"
                disabled={submitting}
              >
                {submitting
                  ? 'PLEASE WAIT...'
                  : mode === 'login'
                    ? citizenLogin && !passwordStep
                      ? 'CONTINUE'
                      : role === 'admin'
                        ? 'LOG IN'
                        : 'SIGN IN'
                    : 'CREATE ACCOUNT'}
              </button>
            </form>
          )}

          {message && (
            <p
              className={`status-message ${
                messageType === 'success' ? 'success-message' : ''
              }`}
              role="status"
              aria-live="polite"
            >
              {message}
            </p>
          )}

          {!pendingGoogleToken && role !== 'admin' && (
            <p className="switch-copy">
              {mode === 'login'
                ? role === 'staff'
                  ? 'Are you a new staff member?'
                  : 'New here?'
                : 'Already have an account?'}{' '}

              <button
                className="text-button"
                type="button"
                onClick={() => {
                  if (mode === 'login' && role === 'staff') {
                    resetStaffRequest()
                    setStep('staff-details')
                  } else {
                    switchMode(mode === 'login' ? 'signup' : 'login')
                  }
                }}
              >
                {mode === 'login'
                  ? role === 'staff'
                    ? 'Enter your details'
                    : 'Create account'
                  : 'Log in'}
              </button>
            </p>
          )}
        </section>
      </main>

      <AuthFooter />
    </>
  )
}
