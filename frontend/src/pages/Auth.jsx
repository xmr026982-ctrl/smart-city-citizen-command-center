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
        {disabled ? 'Connecting to Google...' : 'Continue with Google'}
      </span>
    </button>
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

  const selectedRole = roles.find((item) => item.id === role)

  const citizenLogin = mode === 'login' && role === 'user'

  const showPasswordField =
    mode === 'signup' || !citizenLogin || passwordStep

  // FIREBASE GOOGLE LOGIN
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
      } else if (error.code === 'auth/unauthorized-domain') {
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
    setStep(nextMode === 'login' ? 'role' : 'credentials')
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

  if (mode === 'login' && step === 'role') {
    return (
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
    )
  }

  return (
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
              ? citizenLogin && !passwordStep
                ? 'CONTINUE'
                : 'CONTINUE'
              : 'CREATE ACCOUNT'}
          </button>
        </form>

        {message && (
          <p className="status-message" role="status">
            {message}
          </p>
        )}

        <p className="switch-copy">
          {mode === 'login'
            ? 'New here?'
            : 'Already have an account?'}{' '}

          <button
            className="text-button"
            type="button"
            onClick={() =>
              switchMode(mode === 'login' ? 'signup' : 'login')
            }
          >
            {mode === 'login' ? 'Create account' : 'Log in'}
          </button>
        </p>
      </section>
    </main>
  )
}
