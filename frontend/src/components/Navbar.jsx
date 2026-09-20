export default function Navbar({ page, onNavigate }) {
  return (
    <nav className="site-nav" aria-label="Main navigation">
      <button
        type="button"
        className={page === 'home' ? 'active' : ''}
        onClick={() => onNavigate('home')}
      >
        Home
      </button>
      <button
        type="button"
        className={page === 'about' ? 'active' : ''}
        onClick={() => onNavigate('about')}
      >
        About
      </button>
      <button onClick={() => onNavigate?.("contact")}>
  Contact
</button>
     
    </nav>
  )
}
