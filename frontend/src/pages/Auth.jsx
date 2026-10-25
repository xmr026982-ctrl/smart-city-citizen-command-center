
import { useState } from 'react'
import { Building2 } from 'lucide-react'
import {
  GoogleAuthProvider,
  signInWithPopup,
} from 'firebase/auth'
import { auth } from '../firebase'

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

const staffWorkAreas = [
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

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [passwordStep, setPasswordStep] = useState(false)

  const [message, setMessage] = useState('')
  const [googleLoading, setGoogleLoading] = useState(false)
  const [staffRequestSubmitted, setStaffRequestSubmitted] =
    useState(false)

  const [staffDetails, setStaffDetails] = useState({
    name: '',
    email: '',
    experience: '',
    workArea: '',
    zone: '',
    note: '',
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

  function switchMode(nextMode) {
    setMode(nextMode)
    setStep(
      nextMode === 'login' ? 'role' : 'credentials'
    )
    setRole(null)
    setEmail('')
    setPassword('')
    setShowPassword(false)
    setPasswordStep(false)
    setMessage('')
  }

  function submit(event) {
    event.preventDefault()
    setMessage('')

    if (citizenLogin && !passwordStep) {
      setPasswordStep(true)
      return
    }

    if (mode === 'login') {
      setMessage(
        `${selectedRole?.name || 'User'} login submitted successfully.`
      )
    } else {
      setMessage('Your account details are ready.')
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

  async function submitStaffDetails(event) {
    event.preventDefault()
    setMessage('')

    try {
      const response = await fetch('http://localhost:5000/api/staff-requests', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: staffDetails.name.trim(),
          email: staffDetails.email.trim().toLowerCase(),
          // Map the existing form fields to the backend's expected field names.
          qualification: staffDetails.experience,
          department: staffDetails.workArea,
        }),
      })

      const data = await response.json().catch(() => ({}))

      if (!response.ok) {
        throw new Error(data.message || 'Failed to submit staff request.')
      }

      setStaffRequestSubmitted(true)
      setMessage(data.message || 'Your staff request has been submitted successfully!')
    } catch (error) {
      console.error('Staff request submission error:', error)
      setMessage(
        error.message || 'Cannot connect to the backend. Please make sure the backend is running.'
      )
    }
  }

  function resetStaffRequest() {
    setStaffDetails({
      name: '',
      email: '',
      experience: '',
      workArea: '',
      zone: '',
      note: '',
    })

    setStaffRequestSubmitted(false)
    setMessage('')
  }

  // Role selection page
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
                  }}
                >
                  <span className="role-icon">
                    {item.icon}
                  </span>

                  <span className="role-copy">
                    <strong>{item.name} Login</strong>
                    <small>{item.description}</small>
                  </span>

                  <span
                    className="role-arrow"
                    aria-hidden="true"
                  >
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

  // Staff request form
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
            <button
              className="back-button"
              type="button"
              onClick={() => {
                setStep('credentials')
                setMessage('')
              }}
            >
              <span aria-hidden="true">←</span> BACK TO STAFF LOGIN
            </button>

            <CityMark role="staff" />

            <h1>Staff Request</h1>

            <p className="intro">
              Provide your staff information for Smart City.
            </p>

            {staffRequestSubmitted ? (
              <div className="staff-request-success">
                <p className="status-message" role="status">
                  Your staff request has been submitted successfully.
                </p>

                <p className="intro">
                  Your request details have been entered. Please contact
                  the administrator regarding approval.
                </p>
              </div>
            ) : (
              <form onSubmit={submitStaffDetails}>
                <label htmlFor="staff-name">
                  Full Name
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
                  style={{ display: 'block', marginTop: '16px' }}
                >
                  Staff Email Address
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

                {/* Experience dropdown */}
                <label
                  htmlFor="staff-experience"
                  style={{ display: 'block', marginTop: '16px' }}
                >
                  Experience
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

                {/* Department / Work Area dropdown */}
                <label
                  htmlFor="staff-work-area"
                  style={{ display: 'block', marginTop: '16px' }}
                >
                  Department / Work Area
                </label>

                <select
                  id="staff-work-area"
                  className="field"
                  name="workArea"
                  value={staffDetails.workArea}
                  onChange={handleStaffDetailsChange}
                  required
                >
                  <option value="">Select your work area</option>

                  {staffWorkAreas.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>

                {/* Zone dropdown */}
                <label
                  htmlFor="staff-zone"
                  style={{ display: 'block', marginTop: '16px' }}
                >
                  Zone
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

                {/* Optional note */}
                <label
                  htmlFor="staff-note"
                  style={{ display: 'block', marginTop: '16px' }}
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
                >
                  SUBMIT REQUEST
                </button>
              </form>
            )}

            {message && !staffRequestSubmitted && (
              <p className="status-message" role="status">
                {message}
              </p>
            )}
          </section>
        </main>

        <AuthFooter />
      </>
    )
  }

  // Login / signup page
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
                setMessage('')
                setPasswordStep(false)
              }}
            >
              <span aria-hidden="true">←</span> ROLES
            </button>
          )}

          <CityMark role={mode === 'login' ? role : null} />

          <h1>
            {mode === 'login' ? 'Sign in' : 'Create account'}
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
            <label htmlFor="identity">
              {mode === 'login' && role === 'staff'
                ? 'Staff ID'
                : 'Email address'}
            </label>

            <input
              id="identity"
              className="field"
              type={
                mode === 'login' && role === 'staff'
                  ? 'text'
                  : 'email'
              }
              placeholder={
                mode === 'login' && role === 'staff'
                  ? 'Enter your staff ID'
                  : 'name@email.com'
              }
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete={
                mode === 'login' ? 'username' : 'email'
              }
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
                      onClick={() =>
                        setMessage(
                          'Connect your password reset flow to enable password recovery.'
                        )
                      }
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

            <button className="submit-button" type="submit">
              {mode === 'login'
                ? 'CONTINUE'
                : 'CREATE ACCOUNT'}
            </button>
          </form>

          {message && (
            <p className="status-message" role="status">
              {message}
            </p>
          )}

          {/* Hide account creation only on Admin Login */}
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
