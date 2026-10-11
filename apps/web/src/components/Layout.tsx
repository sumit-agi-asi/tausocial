import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth';
import { Logo } from './Logo';

export function Layout() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  return (
    <>
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <header className="site-header">
        <div className="container header-inner">
          <NavLink to="/feed" aria-label="TauSocial home">
            <Logo />
          </NavLink>
          {user ? (
            <nav aria-label="Main">
              <NavLink to="/feed">Feed</NavLink>
              <NavLink to="/connections">Connections</NavLink>
              <NavLink to="/verify">Verify</NavLink>
              <NavLink to="/settings">Settings</NavLink>
              <button
                type="button"
                className="btn"
                onClick={() => {
                  signOut();
                  navigate('/login');
                }}
              >
                Log out
              </button>
            </nav>
          ) : (
            <nav aria-label="Main">
              <NavLink to="/login">Log in</NavLink>
              <NavLink to="/signup">Sign up</NavLink>
            </nav>
          )}
        </div>
      </header>
      <main id="main" className="container" tabIndex={-1}>
        <Outlet />
      </main>
      <footer className="container muted small site-footer">
        TauSocial: social media with accountability like never before, monitored by intelligence.
      </footer>
    </>
  );
}
