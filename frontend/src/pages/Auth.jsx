
import { useState } from 'react'
import { Building2 } from 'lucide-react'
import {
  GoogleAuthProvider,
  signInWithPopup,
} from 'firebase/auth'
import { auth } from '../firebase'

const API_URL = 'http://127.0.0.1:5000/api'

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

const staffexpertise = [
  'Electrical',
  'Roads',
  'Waste',
  'Water',
  'Civic',
]

const staffZones = [
  'Shyambazar',
  'B.B.D. Bagh',
  'Ballygunge',
  'College Street',
  'B.P. Township',
  'Dharmatala',
]

const emptyStaffDetails = {
  name: '',
  email: '',
  experience: '',
  workArea: '',
  zone: '',
  note: '',
}

// Red asterisk for required fields.
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
        : role === 'user'
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
        {disabled
          ? 'Connecting to Google...'
          : 'Continue with Google'}
      </span>
    </button>
  )
}

function AuthFooter() {
  return (
    <footer className="auth-footer">
      © 2026 Smart City
    </footer>
  )
}

export default function App() {
  const [mode, setMode] = useState('login')
  const [step, setStep] = useState('role')
  const [role, setRole] = useState(null)

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [passwordStep, setPasswordStep] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const [message, setMessage] = useState('')
  const [googleLoading, setGoogleLoading] = useState(false)
  const [staffSubmitting, setStaffSubmitting] = useState(false)
  const [staffRequestSubmitted, setStaffRequestSubmitted] =
    useState(false)

  const [staffDetails, setStaffDetails] = useState({
    ...emptyStaffDetails,
  })

  const selectedRole = roles.find(
    (item) => item.id === role
  )

  const citizenLogin =
    mode === 'login' && role === 'user'

  const showPasswordField =
    mode === 'signup' ||
    !citizenLogin ||
    passwordStep

  function switchMode(nextMode) {
    setMode(nextMode)
    setStep(nextMode === 'login' ? 'role' : 'credentials')
    setRole(null)
    setName('')
    setEmail('')
    setPassword('')
    setShowPassword(false)
    setPasswordStep(false)
    setMessage('')
    setStaffRequestSubmitted(false)
    setSubmitting(false)
  }

  // Admin, staff and citizen login.
  // Citizen registration is also handled here.
  async function submit(event) {
    event.preventDefault()

    if (submitting) return

    setMessage('')

    // Citizen login: ask for email before showing password.
    if (citizenLogin && !passwordStep) {
      if (!email.trim()) {
        setMessage('Please enter your email address.')
        return
      }

      setPasswordStep(true)
      return
    }

    setSubmitting(true)

    try {
      if (mode === 'login') {
        // Keep the existing admin login endpoint and role.
        const response = await fetch(
          `${API_URL}/auth/login`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              email: email.trim().toLowerCase(),
              password,
              role,
            }),
          }
        )

        const data = await response.json().catch(() => ({}))

        if (!response.ok) {
          throw new Error(data.message || 'Login failed.')
        }

        if (!data.token || !data.user) {
          throw new Error(
            'The server did not return a login token and user.'
          )
        }

        // Save the authenticated session.
        localStorage.setItem('token', data.token)
        localStorage.setItem('user', JSON.stringify(data.user))

        setMessage(
          `${selectedRole?.name || 'User'} login successful!`
        )

        console.log('Authenticated user:', data.user)

        // Dashboard navigation can be added after confirming
        // the routes in your React application.
      } else {
        // Citizen registration.
        if (!name.trim()) {
          throw new Error('Please enter your full name.')
        }

        const response = await fetch(
          `${API_URL}/auth/register`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              name: name.trim(),
              email: email.trim().toLowerCase(),
              password,
              role: 'citizen',
            }),
          }
        )

        const data = await response.json().catch(() => ({}))

        if (!response.ok) {
          throw new Error(
            data.message || 'Account registration failed.'
          )
        }

        setMessage(
          data.message ||
            'Your citizen account was created successfully.'
        )
      }
    } catch (error) {
      console.error('Authentication error:', error)

      setMessage(
        error.message ||
          'Unable to connect to the backend. Please try again.'
      )
    } finally {
      setSubmitting(false)
    }
  }

  // Existing Firebase Google sign-in.
  async function handleGoogleLogin() {
    setMessage('')
    setGoogleLoading(true)

    try {
      const provider = new GoogleAuthProvider()

      provider.setCustomParameters({
        prompt: 'select_account',
      })

      const result = await signInWithPopup(auth, provider)
      const googleUser = result.user

      setEmail(googleUser.email || '')

      setMessage(
        `Google sign-in successful! Welcome, ${
          googleUser.displayName || googleUser.email
        }.`
      )

      console.log('Firebase user:', {
        uid: googleUser.uid,
        name: googleUser.displayName,
        email: googleUser.email,
      })
    } catch (error) {
      console.error(
        'Google sign-in error:',
        error.code,
        error.message
      )

      if (error.code === 'auth/popup-closed-by-user') {
        setMessage('Google sign-in was cancelled.')
      } else if (
        error.code === 'auth/unauthorized-domain'
      ) {
        setMessage(
          'This website is not authorized in Firebase. Add localhost to Authorized domains.'
        )
      } else if (error.code === 'auth/popup-blocked') {
        setMessage(
          'Your browser blocked the popup. Allow popups and try again.'
        )
      } else {
        setMessage(error.message || 'Google sign-in failed.')
      }
    } finally {
      setGoogleLoading(false)
    }
  }

  function handleStaffDetailsChange(event) {
    const { name, value } = event.target

    setStaffDetails((previous) => ({
      ...previous,
      [name]: value,
    }))

    setMessage('')
  }

  // Submit staff application for administrator approval.
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

    if (
      !staffName ||
      !staffEmail ||
      !experience ||
      !expertise ||
      !zone
    ) {
      setMessage(
        'Please fill in all required staff application fields.'
      )
      return
    }

    setStaffSubmitting(true)

    try {
      const response = await fetch(
        `${API_URL}/staff-requests`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            name: staffName,
            email: staffEmail,

            // These names must match the backend controller
            // and the existing StaffRequest model.
            Experience: experience,
            Expertise: expertise,

            zone,
            note,
          }),
        }
      )

      const data = await response.json().catch(() => ({}))

      if (!response.ok) {
        throw new Error(
          data.message ||
            'Could not submit your staff application.'
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

      setMessage('')
      setStaffRequestSubmitted(true)
    } catch (error) {
      console.error('Staff application error:', error)

      setMessage(
        error.message ||
          'Unable to connect to the server. Please try again.'
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
  }

  // Role selection screen.
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

            <p className="intro">
              Choose your login type to continue.
            </p>

            <div className="role-options">
              {roles.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className="role-card"
                  onClick={() => {
                    setRole(item.id)
                    setStep('credentials')
                    setMessage('')
                    setPasswordStep(false)
                    setEmail('')
                    setPassword('')
                  }}
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

  // Staff application and success screen.
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
                <div className="success-icon" aria-hidden="true">
                  ✓
                </div>

                <h1>Request Submitted Successfully!</h1>

                <p className="success-description">
                  Thank you, {staffDetails.name}. Your staff
                  application has been submitted successfully.
                </p>

                <div className="success-details">
                  <p>
                    <strong>Status:</strong>{' '}
                    <span className="pending-badge">
                      Pending Approval
                    </span>
                  </p>

                  <p>
                    <strong>Email:</strong> {staffDetails.email}
                  </p>

                  <p>
                    <strong>Expertise:</strong>{' '}
                    {staffDetails.workArea}
                  </p>

                  <p>
                    <strong>Zone:</strong> {staffDetails.zone}
                  </p>
                </div>

                <p className="success-note">
                  Your application is awaiting administrator review.
                  If it is approved, you will receive an email with
                  instructions to set up your staff password.
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

                  <label
                    htmlFor="staff-email"
                    className="staff-field-label"
                  >
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

                  <label
                    htmlFor="staff-experience"
                    className="staff-field-label"
                  >
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
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </select>

                  <label
                    htmlFor="staff-work-area"
                    className="staff-field-label"
                  >
                    Staff Expertise <RequiredMark />
                  </label>

                  <select
                    id="staff-work-area"
                    className="field"
                    name="workArea"
                    value={staffDetails.workArea}
                    onChange={handleStaffDetailsChange}
                    required
                  >
                    <option value="">Select your expertise</option>
                    {staffexpertise.map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </select>

                  <label
                    htmlFor="staff-zone"
                    className="staff-field-label"
                  >
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
                    {staffZones.map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </select>

                  <label
                    htmlFor="staff-note"
                    className="staff-field-label"
                  >
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
                    {staffSubmitting
                      ? 'SUBMITTING REQUEST...'
                      : 'SUBMIT REQUEST'}
                  </button>
                </form>

                {message && (
                  <p
                    className="status-message"
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

  // Send a password-reset request for the entered email address.
  async function handleForgotPassword() {
    const normalizedEmail = email.trim().toLowerCase()

    if (!normalizedEmail) {
      setMessage('Please enter your email address first.')
      return
    }

    setMessage('')

    try {
      const response = await fetch(`${API_URL}/auth/forgot-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email: normalizedEmail }),
      })

      const data = await response.json().catch(() => ({}))

      if (!response.ok) {
        throw new Error(
          data.message || 'Unable to process your password-reset request.'
        )
      }

      setMessage(
        data.message ||
          'If an eligible account exists, password-reset instructions will be sent to your email.'
      )
    } catch (error) {
      console.error('Forgot-password error:', error)
      setMessage(
        error.message ||
          'Unable to connect to the server. Please try again.'
      )
    }
  }

  // Login and signup screen.
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
              <GoogleButton
                onClick={handleGoogleLogin}
                disabled={googleLoading}
              />

              <div className="divider">
                <span>or</span>
              </div>
            </>
          )}

          <form onSubmit={submit}>
            {mode === 'signup' && (
              <>
                <label htmlFor="full-name">Full name</label>
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

            {showPasswordField && (
              <>
                <div className="password-label">
                  <label htmlFor="password">Password</label>

                  {mode === 'login' && (
                    <button
                      type="button"
                      className="text-button"
                      onClick={handleForgotPassword}
                    >
                      Forgot password?
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
                    onChange={(event) =>
                      setPassword(event.target.value)
                    }
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
                    onClick={() =>
                      setShowPassword((visible) => !visible)
                    }
                    aria-label={
                      showPassword ? 'Hide password' : 'Show password'
                    }
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

          {message && (
            <p
              className="status-message"
              role="status"
              aria-live="polite"
            >
              {message}
            </p>
          )}

          {role !== 'admin' && (
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
                    switchMode(
                      mode === 'login' ? 'signup' : 'login'
                    )
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
