import { Outlet, Link, useLocation } from 'react-router-dom'

export default function Layout() {
  const location = useLocation()
  const isHome = location.pathname === '/'

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">
      {/* Top nav — navy background with white logo */}
      <header style={{ backgroundColor: '#002247' }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-16">
          <Link to="/">
            <img
              src="/logo-white.png"
              alt="TriState — a member of DAIKIN group"
              className="h-9 w-auto"
            />
          </Link>

          <div className="flex items-center gap-4">
            <span className="text-white/60 text-xs font-medium uppercase tracking-widest">
              Sterling Pricing
            </span>
            {!isHome && (
              <Link
                to="/"
                className="text-sm font-medium px-3 py-1.5 rounded transition-colors"
                style={{ color: '#ffffff', backgroundColor: 'rgba(255,255,255,0.1)' }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.2)')}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.1)')}
              >
                ← All Jobs
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* Page content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <Outlet />
      </main>

      {/* Footer — navy */}
      <footer style={{ backgroundColor: '#002247' }} className="mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <img
            src="/logo-white.png"
            alt="TriState"
            className="h-6 w-auto opacity-70"
          />
          <p className="text-xs" style={{ color: 'rgba(255,255,255,0.45)' }}>
            Sterling Price Sheet C35R &nbsp;·&nbsp; TriState HVAC
          </p>
        </div>
      </footer>
    </div>
  )
}
