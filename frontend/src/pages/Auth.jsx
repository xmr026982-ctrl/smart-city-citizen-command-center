import { useState } from 'react'


const roles = [
  {
    id: 'admin',
    name: 'Admin',
    description: 'Manage city operations',
    icon: '⚙️'
  },
  {
    id: 'staff',
    name: 'Staff',
    description: 'Access staff services',
    icon: '🧑‍💼'
  },
  {
    id: 'user',
    name: 'User',
    description: 'Access smart city services',
    icon: '👤'
  }
]

function BrandMark() {
  return (
    <div
      className="brand-lockup"
      aria-label="Smart City"
    >
      <svg
        className="brand-mark"
        viewBox="0 0 80 80"
        role="img"
        aria-label="Smart City S logo"
      >
        <rect
          x="8"
          y="8"
          width="64"
          height="64"
          rx="17"
          fill="#286957"
        />

        <text
          x="40"
          y="55"
          textAnchor="middle"
          fill="#fff"
          fontFamily="Georgia, serif"
          fontSize="47"
          fontWeight="700"
        >
          S
        </text>
      </svg>

      <span className="brand-wordmark">
        𝙨𝙢𝙖𝙧𝙩 𝙘𝙞𝙩𝙮
      </span>
    </div>
  )
}

function GoogleButton({ onClick, label }) {
  return (
    <button
      className="google-button"
      type="button"
      onClick={onClick}
    >
      <svg
        className="google-icon"
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <path
          fill="#4285F4"
          d="M21.35 12.22c0-.72-.06-1.42-.18-2.09H12v3.96h5.24a4.48 4.48 0 0 1-1.94 2.94v2.45h3.14c1.84-1.7 2.91-4.2 2.91-7.26Z"
        />

        <path
          fill="#34A853"
          d="M12 21.99c2.63 0 4.84-.87 6.45-2.36l-3.14-2.45c-.87.58-1.98.92-3.31.92-2.54 0-4.7-1.72-5.47-4.03H3.29v2.53A9.74 9.74 0 0 0 12 21.99Z"
        />

        <path
          fill="#FBBC05"
          d="M6.53 14.07a5.86 5.86 0 0 1 0-3.74V7.8H3.29a9.75 9.75 0 0 0 0 8.8l3.24-2.53Z"
        />

        <path
          fill="#EA4335"
          d="M12 6.3c1.43 0 2.71.49 3.72 1.45l2.79-2.79C16.84 3.4 14.63 2.5 12 2.5a9.74 9.74 0 0 0-8.71 5.3l3.24 2.53C7.3 8.02 9.46 6.3 12 6.3Z"
        />
      </svg>

      {label}
    </button>
  )
}

function AuthPage({ initialMode }) {
  const [mode, setMode] = useState(initialMode)

  const [step, setStep] = useState(
    initialMode === 'login'
      ? 'role'
      : 'credentials'
  )

  const [role, setRole] = useState(null)

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  const [showPassword, setShowPassword] = useState(false)

  const [signupStep, setSignupStep] =
    useState('email')

  const [userPasswordStep, setUserPasswordStep] =
    useState(false)

  const [message, setMessage] = useState('')

  const selectedRole = roles.find(
    (item) => item.id === role
  )

  const switchMode = (nextMode) => {
    setMode(nextMode)

    setStep(
      nextMode === 'login'
        ? 'role'
        : 'credentials'
    )

    setRole(null)
    setEmail('')
    setPassword('')
    setShowPassword(false)
    setSignupStep('email')
    setUserPasswordStep(false)
    setMessage('')
  }

  const submit = (event) => {
    event.preventDefault()

    /*
      USER LOGIN

      First step:
      User enters email.

      Second step:
      User enters password.
    */
    if (
      mode === 'login' &&
      role === 'user' &&
      !userPasswordStep
    ) {
      setUserPasswordStep(true)
      return
    }

    /*
      SIGN UP

      First step:
      User enters email.

      Second step:
      User creates password.
    */
    if (
      mode === 'signup' &&
      signupStep === 'email'
    ) {
      setSignupStep('password')
      return
    }

    /*
      Temporary frontend message.

      Later this section can be connected
      to your backend API.

      Person 6 can connect Admin login here.
    */
    setMessage(
      mode === 'login'
        ? `${selectedRole?.name} login submitted successfully.`
        : 'Your account has been created successfully.'
    )
  }

  const showPasswordField =
    (mode === 'signup' &&
      signupStep === 'password') ||
    (mode === 'login' &&
      (role !== 'user' ||
        userPasswordStep))

  return (
    <main className="auth-page">

      <section
        className={`auth-card ${
          mode === 'login' && role
            ? `${role}-login-card`
            : ''
        }`}
      >

        <BrandMark />

        {/* ========================= */}
        {/* LOGIN ROLE SELECTION       */}
        {/* ========================= */}

        {mode === 'login' &&
        step === 'role' ? (
          <>
            <h1>Login to Smart City</h1>

            <p className="intro">
              Choose your login type to continue.
            </p>

            <div className="role-page-options">

              {roles.map((item) => (
                <button
                  className="role-card"
                  type="button"
                  key={item.id}
                  onClick={() => {
                    setRole(item.id)
                    setStep('credentials')
                    setMessage('')
                  }}
                >
                  <span className="role-card-icon">
                    {item.icon}
                  </span>

                  <span className="role-card-copy">
                    <strong>
                      {item.name} Login
                    </strong>

                    <small>
                      {item.description}
                    </small>
                  </span>

                  <span className="role-arrow">
                    →
                  </span>
                </button>
              ))}

            </div>
          </>
        ) : (
          <>
            {/* ========================= */}
            {/* BACK BUTTON                 */}
            {/* ========================= */}

            {mode === 'login' && (
              <button
                className="back-button"
                type="button"
                onClick={() => {
                  setStep('role')
                  setRole(null)
                  setMessage('')
                }}
              >
                ← Back to login options
              </button>
            )}

            {/* ========================= */}
            {/* SELECTED ROLE               */}
            {/* ========================= */}

            {mode === 'login' &&
              selectedRole && (
                <div
                  className={`login-identity ${role}-identity`}
                >
                  <span className="login-identity-icon">
                    {selectedRole.icon}
                  </span>

                  <div>
                    <strong>
                      {selectedRole.name} Portal
                    </strong>

                    <small>
                      {selectedRole.description}
                    </small>
                  </div>
                </div>
              )}

            {/* ========================= */}
            {/* TITLE                       */}
            {/* ========================= */}

            <h1>
              {mode === 'login'
                ? `${selectedRole?.name} Login`
                : 'Create your account'}
            </h1>

            <p className="intro">
              {mode === 'login'
                ? `Log in as ${selectedRole?.name} to continue.`
                : 'Create your account to access smart city services.'}
            </p>

            {/* ========================= */}
            {/* GOOGLE LOGIN                */}
            {/* ========================= */}

            {(mode === 'signup' ||
              (mode === 'login' &&
                role === 'user')) && (
              <>
                <GoogleButton
                  label="Continue with Google"
                  onClick={() =>
                    setMessage(
                      mode === 'signup'
                        ? 'Google sign-up selected.'
                        : 'Google sign-in selected.'
                    )
                  }
                />

                <div className="divider">
                  <span>or</span>
                </div>
              </>
            )}

            {/* ========================= */}
            {/* LOGIN / SIGNUP FORM         */}
            {/* ========================= */}

            <form onSubmit={submit}>

              <label htmlFor="identity">
                {mode === 'login' &&
                role === 'staff'
                  ? 'Staff ID'
                  : 'Email address'}
              </label>

              <input
                id="identity"
                type={
                  mode === 'login' &&
                  role === 'staff'
                    ? 'text'
                    : 'email'
                }
                placeholder={
                  mode === 'login' &&
                  role === 'staff'
                    ? 'Enter your staff ID'
                    : 'Enter your email address'
                }
                value={email}
                onChange={(event) =>
                  setEmail(event.target.value)
                }
                required
              />

              {/* ========================= */}
              {/* PASSWORD                    */}
              {/* ========================= */}

              {showPasswordField && (
                <>
                  <div className="password-label">

                    <label htmlFor="password">
                      Password
                    </label>

                    {mode === 'login' && (
                      <button
                        type="button"
                        className="text-button"
                        onClick={() =>
                          setMessage(
                            'Password reset option selected.'
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
                      type={
                        showPassword
                          ? 'text'
                          : 'password'
                      }
                      placeholder="Enter your password"
                      value={password}
                      onChange={(event) =>
                        setPassword(
                          event.target.value
                        )
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
                        setShowPassword(
                          !showPassword
                        )
                      }
                      aria-label={
                        showPassword
                          ? 'Hide password'
                          : 'Show password'
                      }
                    >
                      {showPassword
                        ? '🙈 Hide'
                        : '👁️ Show'}
                    </button>

                  </div>
                </>
              )}

              {/* ========================= */}
              {/* SUBMIT BUTTON              */}
              {/* ========================= */}

              <button
                className="submit-button"
                type="submit"
              >
                {mode === 'login'
                  ? role === 'user' &&
                    !userPasswordStep
                    ? 'CONTINUE'
                    : 'LOGIN'
                  : signupStep === 'email'
                    ? 'CONTINUE'
                    : 'CREATE ACCOUNT'}
              </button>

            </form>

            {/* ========================= */}
            {/* MESSAGE                     */}
            {/* ========================= */}

            {message && (
              <p
                className="success-message"
                role="status"
              >
                {message}
              </p>
            )}

            {/* ========================= */}
            {/* LOGIN / SIGNUP SWITCH       */}
            {/* ========================= */}

            <p className="switch-copy">

              {mode === 'login'
                ? "Don't have an account?"
                : 'Already have an account?'}

              {' '}

              <button
                type="button"
                className="text-button switch-button"
                onClick={() =>
                  switchMode(
                    mode === 'login'
                      ? 'signup'
                      : 'login'
                  )
                }
              >
                {mode === 'login'
                  ? 'Sign up'
                  : 'Log in'}
              </button>

            </p>
          </>
        )}

        {/* ========================= */}
        {/* SIGNUP FROM ROLE PAGE      */}
        {/* ========================= */}

        {mode === 'login' &&
          step === 'role' && (
            <p className="switch-copy role-switch">
              Don't have an account?{' '}

              <button
                type="button"
                className="text-button switch-button"
                onClick={() =>
                  switchMode('signup')
                }
              >
                Sign up
              </button>
            </p>
          )}

      </section>

    </main>
  )
}

export default function Auth({ initialMode = 'login' }) {
  return (
    <AuthPage initialMode={initialMode} />
  )
}
