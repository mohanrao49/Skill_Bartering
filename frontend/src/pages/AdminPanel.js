import React, { useState, useEffect, useCallback } from 'react';
import axios from '../utils/axiosConfig';
import { useAuth } from '../context/AuthContext';
import { Navigate } from 'react-router-dom';

const AdminPanel = () => {
  const { isAdmin } = useAuth();
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [swapRequests, setSwapRequests] = useState([]);
  const [swapSessions, setSwapSessions] = useState([]);
  const [activeTab, setActiveTab] = useState('stats');
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      if (activeTab === 'stats') {
        const response = await axios.get('/api/admin/stats');
        setStats(response.data.statistics);
      } else if (activeTab === 'users') {
        const response = await axios.get('/api/admin/users');
        setUsers(response.data.users);
      } else if (activeTab === 'swap-requests') {
        const response = await axios.get('/api/admin/swap-requests');
        setSwapRequests(response.data.swap_requests);
      } else if (activeTab === 'swap-sessions') {
        const response = await axios.get('/api/admin/swap-sessions');
        setSwapSessions(response.data.swap_sessions);
      }
    } catch (error) {
      console.error('Error fetching admin data:', error);
      alert('Failed to load admin data');
    } finally {
      setLoading(false);
    }
  }, [activeTab]);

  useEffect(() => {
    if (isAdmin) {
      fetchData();
    }
  }, [isAdmin, activeTab, fetchData]);

  const handleCancelSwap = async (sessionId) => {
    if (!window.confirm('Cancel this swap session?')) return;
    try {
      await axios.post(`/api/admin/swap-sessions/${sessionId}/cancel`);
      alert('Swap session cancelled');
      fetchData();
    } catch (error) {
      alert(error.response?.data?.error || 'Failed to cancel swap');
    }
  };

  if (!isAdmin) {
    return <Navigate to="/dashboard" />;
  }

  if (loading) {
    return <div className="loading">Loading admin panel...</div>;
  }

  return (
    <div className="container">
      <div className="page-header">
        <h1>Admin Panel</h1>
        <p>Manage platform users and swaps</p>
      </div>

      {/* Tabs */}
      <div style={{ marginBottom: '20px', borderBottom: '2px solid #ddd' }}>
        <button
          className={`btn ${activeTab === 'stats' ? 'btn-primary' : 'btn-outline'}`}
          onClick={() => setActiveTab('stats')}
          style={{ marginRight: '10px', borderRadius: '5px 5px 0 0' }}
        >
          Statistics
        </button>
        <button
          className={`btn ${activeTab === 'users' ? 'btn-primary' : 'btn-outline'}`}
          onClick={() => setActiveTab('users')}
          style={{ marginRight: '10px', borderRadius: '5px 5px 0 0' }}
        >
          Users
        </button>
        <button
          className={`btn ${activeTab === 'swap-requests' ? 'btn-primary' : 'btn-outline'}`}
          onClick={() => setActiveTab('swap-requests')}
          style={{ marginRight: '10px', borderRadius: '5px 5px 0 0' }}
        >
          Swap Requests
        </button>
        <button
          className={`btn ${activeTab === 'swap-sessions' ? 'btn-primary' : 'btn-outline'}`}
          onClick={() => setActiveTab('swap-sessions')}
          style={{ borderRadius: '5px 5px 0 0' }}
        >
          Swap Sessions
        </button>
      </div>

      {/* Statistics Tab */}
      {activeTab === 'stats' && stats && (
        <div className="grid-2">
          <div className="card">
            <h2>Platform Statistics</h2>
            <p><strong>Total Users:</strong> {stats.total_users}</p>
            <p><strong>Total Swaps:</strong> {stats.total_swaps}</p>
            <p><strong>Active Swaps:</strong> {stats.active_swaps}</p>
            <p><strong>Completed Swaps:</strong> {stats.completed_swaps}</p>
            <p><strong>Total Skills:</strong> {stats.total_skills}</p>
          </div>
        </div>
      )}

      {/* Users Tab */}
      {activeTab === 'users' && (
        <div className="card">
          <h2>All Users</h2>
          <div className="grid">
            {users.map((user) => (
              <div key={user.id} className="match-card">
                <h3>{user.full_name || user.username}</h3>
                <p><strong>Username:</strong> {user.username}</p>
                <p><strong>Email:</strong> {user.email}</p>
                <p><strong>Rating:</strong> ⭐ {user.rating?.toFixed(1) || '0.0'}</p>
                <p><strong>Total Swaps:</strong> {user.total_swaps || 0}</p>
                <p><strong>Admin:</strong> {user.is_admin ? 'Yes' : 'No'}</p>
                <p><strong>Joined:</strong> {new Date(user.created_at).toLocaleDateString()}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Swap Requests Tab */}
      {activeTab === 'swap-requests' && (
        <div className="card">
          <h2>All Swap Requests</h2>
          <div className="grid">
            {swapRequests.map((request) => (
              <div key={request.id} className="match-card">
                <h3>Request #{request.id}</h3>
                <p><strong>From:</strong> {request.requester_username} ({request.requester_email})</p>
                <p><strong>To:</strong> {request.receiver_username} ({request.receiver_email})</p>
                <p><strong>Skill Offered:</strong> {request.requester_skill_name}</p>
                <p><strong>Skill Requested:</strong> {request.receiver_skill_name}</p>
                <p><strong>Status:</strong> {request.status}</p>
                <p><strong>Date:</strong> {new Date(request.created_at).toLocaleString()}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Swap Sessions Tab */}
      {activeTab === 'swap-sessions' && (
        <div className="card">
          <h2>All Swap Sessions</h2>
          <div className="grid">
            {swapSessions.map((session) => (
              <div key={session.id} className="match-card">
                <h3>Session #{session.id}</h3>
                <p><strong>User 1:</strong> {session.user1_username} ({session.user1_email})</p>
                <p><strong>User 2:</strong> {session.user2_username} ({session.user2_email})</p>
                <p><strong>Skill 1:</strong> {session.user1_skill_name}</p>
                <p><strong>Skill 2:</strong> {session.user2_skill_name}</p>
                <p><strong>Status:</strong> {session.status}</p>
                <p><strong>Started:</strong> {new Date(session.started_at).toLocaleString()}</p>
                {session.completed_at && (
                  <p><strong>Completed:</strong> {new Date(session.completed_at).toLocaleString()}</p>
                )}
                {session.status === 'ACTIVE' && (
                  <button
                    className="btn btn-danger"
                    onClick={() => handleCancelSwap(session.id)}
                    style={{ marginTop: '10px' }}
                  >
                    Cancel Swap
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminPanel;

