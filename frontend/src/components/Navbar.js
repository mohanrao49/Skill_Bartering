import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { API_BASE_URL } from '../services/api';
import './Navbar.css';

const Navbar = () => {
  const { isAuthenticated, user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  if (!isAuthenticated) {
    return (
      <nav className="navbar">
        <div className="container">
          <Link to="/" className="navbar-brand">Skill Swap</Link>
          <div className="navbar-links">
            <Link to="/login">Login</Link>
            <Link to="/register">Register</Link>
          </div>
        </div>
      </nav>
    );
  }

  return (
    <nav className="navbar">
      <div className="container">
        <Link to="/dashboard" className="navbar-brand">Skill Swap</Link>
        <div className="navbar-links">
          <Link to="/dashboard">Dashboard</Link>
          <Link to="/profile">Profile</Link>
          <Link to="/swap-requests">Swap Requests</Link>
          <div className="navbar-user">
            {user?.profile_pic ? (
              <img 
                src={`${API_BASE_URL}${user.profile_pic}`} 
                alt={user?.username} 
                className="user-avatar"
              />
            ) : (
              <div className="user-avatar" style={{
                width: '40px',
                height: '40px',
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'white',
                fontWeight: 'bold',
                fontSize: '16px'
              }}>
                {user?.username?.charAt(0).toUpperCase() || 'U'}
              </div>
            )}
            <span style={{ color: 'rgba(255, 255, 255, 0.9)', fontWeight: 600 }}>Hello, {user?.username}</span>
            <button onClick={handleLogout} className="btn btn-outline" style={{padding: '5px 15px', fontSize: '14px'}}>
              Logout
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;

