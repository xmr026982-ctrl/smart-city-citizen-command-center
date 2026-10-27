
import { useEffect } from 'react'
import {
  Routes,
  Route,
  Navigate,
  useLocation,
  useNavigate,
} from 'react-router-dom'

import Home from './pages/Home.jsx'
import Auth from './pages/Auth.jsx'
import About from './pages/About.jsx'
import PlatformPreview from './pages/PlatformPreview.jsx'
import SetStaffPassword from './pages/SetStaffPassword.jsx'
import Navbar from './components/Navbar.jsx'
import Footer from './components/Footer.jsx'
import Contact from './pages/contact.jsx'
import ResetPassword from './pages/ResetPassword.jsx'

import './App.css'

const routeMap = {
  home: '/',
  preview: '/preview',
  about: '/about',
  contact: '/contact',
  auth: '/login',
  signup: '/register',
  'reset-password': '/reset-password',
  'staff-password': '/staff-password',
}

const pathToPage = {
  '/': 'home',
  '/preview': 'preview',
  '/about': 'about',
  '/contact': 'contact',
  '/login': 'auth',
  '/register': 'signup',
  '/reset-password': 'reset-password',
  '/staff-password': 'staff-password',
}

function AppContent() {
  const navigate = useNavigate()
  const location = useLocation()

  const page = pathToPage[location.pathname] || 'home'

  // Keep older links such as /?page=about working.
  useEffect(() => {
    if (location.pathname !== '/') return

    const oldPage = new URLSearchParams(
      location.search
    ).get('page')

    if (oldPage && routeMap[oldPage]) {
      navigate(routeMap[oldPage], { replace: true })
    }
  }, [location.pathname, location.search, navigate])

  // Preserve the onNavigate interface used by your components.
  const handleNavigate = (nextPage) => {
    const nextRoute = routeMap[nextPage]

    if (nextRoute) {
      navigate(nextRoute)
    }
  }

  const showNavigation = [
    'home',
    'about',
    'contact',
  ].includes(page)

  const hideFooter = [
    'auth',
    'signup',
    'staff-password',
    'reset-password',
  ].includes(page)

  return (
    <>
      {showNavigation && (
        <Navbar
          page={page}
          onNavigate={handleNavigate}
        />
      )}

      <Routes>
        <Route
          path="/"
          element={<Home onNavigate={handleNavigate} />}
        />

        <Route
          path="/preview"
          element={
            <PlatformPreview onNavigate={handleNavigate} />
          }
        />

        <Route
          path="/about"
          element={<About />}
        />

        <Route
          path="/contact"
          element={<Contact />}
        />

        <Route
          path="/login"
          element={<Auth key="login" initialMode="login" />}
        />

        <Route
          path="/register"
          element={<Auth key="signup" initialMode="signup" />}
        />

        <Route
          path="/reset-password"
          element={<ResetPassword />}
        />

        <Route
          path="/staff-password"
          element={<SetStaffPassword />}
        />

        {/* Unknown URLs return to Home. */}
        <Route
          path="*"
          element={<Navigate to="/" replace />}
        />
      </Routes>

      {!hideFooter && <Footer page={page} />}
    </>
  )
}

export default function App() {
  return <AppContent />
}
