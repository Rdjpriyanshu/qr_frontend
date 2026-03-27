import { useAuth } from '../context/AuthContext';

export default function Navbar() {
  const { user, logout } = useAuth();

  if (!user) return null;

  return (
    <nav className="navbar">
      <a href="/" className="navbar-brand">
        <span className="logo-icon">📋</span>
        <span>QR Attend</span>
      </a>
      <div className="navbar-user">
        <span className={`navbar-role ${user.role}`}>{user.role}</span>
        <span className="navbar-name">{user.name}</span>
        <button className="btn-logout" onClick={logout} id="btn-logout">
          Logout
        </button>
      </div>
    </nav>
  );
}
