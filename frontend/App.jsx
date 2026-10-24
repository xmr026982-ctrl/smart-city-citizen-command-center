
import { useState } from 'react'
import Home from './pages/Home.jsx'
import Auth from './pages/Auth.jsx'
import About from './pages/About.jsx'
import PlatformPreview from './pages/PlatformPreview.jsx'
import SetStaffPassword from './pages/SetStaffPassword.jsx'
import Navbar from './components/Navbar.jsx'
import Footer from './components/Footer.jsx'
import Contact from './pages/contact.jsx'
import './App.css'

export default function App() {
  const [page, setPage] = useState('home')

  const showNavigation =
    page === 'home' ||
    page === 'about' ||
    page === 'contact'

  return (
    <>
      {showNavigation && (
        <Navbar
          page={page}
          onNavigate={setPage}
        />
      )}

      {page === 'home' && (
        <Home onNavigate={setPage} />
      )}

      {page === 'preview' && (
        <PlatformPreview onNavigate={setPage} />
      )}

      {page === 'about' && (
        <About />
      )}

      {page === 'contact' && (
        <Contact />
      )}

      {page === 'auth' && (
        <Auth initialMode="login" />
      )}

      {page === 'signup' && (
        <Auth initialMode="signup" />
      )}

      {page === 'staff-password' && (
        <SetStaffPassword />
      )}

      {page !== 'auth' &&
        page !== 'signup' &&
        page !== 'staff-password' && (
          <Footer page={page} />
        )}
    </>
  )
}
