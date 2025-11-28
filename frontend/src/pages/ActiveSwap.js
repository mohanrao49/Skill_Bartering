import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from '../utils/axiosConfig';
import { useAuth } from '../context/AuthContext';

const ActiveSwap = () => {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [swapData, setSwapData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('sessions');
  
  // Forms
  const [sessionForm, setSessionForm] = useState({
    topic: '',
    session_type: 'Online',
    scheduled_date: '',
    duration_hours: 1,
    notes: '',
    meeting_link: '',
    place: ''
  });
  const [resourceForm, setResourceForm] = useState({
    resource_type: 'Link',
    title: '',
    content: ''
  });
  const [messageText, setMessageText] = useState('');

  const fetchSwapData = useCallback(async () => {
    try {
      const response = await axios.get(`/api/swap-sessions/${id}`);
      setSwapData(response.data);
    } catch (error) {
      console.error('Error fetching swap data:', error);
      alert('Failed to load swap details');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchSwapData();
    // Poll for new messages every 5 seconds
    const interval = setInterval(fetchSwapData, 5000);
    return () => clearInterval(interval);
  }, [fetchSwapData]);

  const handleCreateSession = async (e) => {
    e.preventDefault();
    if (!swapData?.swap_session) return;

    // Validate required fields based on session type
    if (sessionForm.session_type === 'Online' && !sessionForm.meeting_link) {
      alert('Please enter a meeting link for online sessions');
      return;
    }
    if (sessionForm.session_type === 'Offline' && !sessionForm.place) {
      alert('Please enter a meeting place for offline sessions');
      return;
    }

    const { user1_id, user2_id } = swapData.swap_session;
    const otherUserId = user.id === user1_id ? user2_id : user1_id;

    try {
      await axios.post('/api/learning-sessions', {
        swap_session_id: id,
        teacher_id: user.id,
        student_id: otherUserId,
        ...sessionForm
      });
      alert('Learning session created!');
      setSessionForm({ topic: '', session_type: 'Online', scheduled_date: '', duration_hours: 1, notes: '', meeting_link: '', place: '' });
      fetchSwapData();
    } catch (error) {
      alert(error.response?.data?.error || 'Failed to create session');
    }
  };

  const handleUpdateSessionStatus = async (sessionId, status) => {
    try {
      await axios.put(`/api/learning-sessions/${sessionId}`, { status });
      fetchSwapData();
    } catch (error) {
      alert(error.response?.data?.error || 'Failed to update session');
    }
  };

  const handleAddResource = async (e) => {
    e.preventDefault();
    try {
      await axios.post('/api/resources', {
        swap_session_id: id,
        uploaded_by: user.id,
        ...resourceForm
      });
      alert('Resource added!');
      setResourceForm({ resource_type: 'Link', title: '', content: '' });
      fetchSwapData();
    } catch (error) {
      alert(error.response?.data?.error || 'Failed to add resource');
    }
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!messageText.trim()) return;
    try {
      await axios.post('/api/messages', {
        swap_session_id: id,
        message_text: messageText
      });
      setMessageText('');
      fetchSwapData();
    } catch (error) {
      alert(error.response?.data?.error || 'Failed to send message');
    }
  };

  const handleCompleteSwap = async () => {
    if (!window.confirm('Mark this swap as completed? Both users will see it as completed. You can still chat and view resources after completion.')) return;
    try {
      const response = await axios.post(`/api/swap-sessions/${id}/complete`);
      console.log('Complete swap response:', response.data);
      alert('Swap marked as completed! It will appear in Swap Requests > Completed section.');
      
      // Refresh swap data to show completed status
      await fetchSwapData();
      
      // Trigger multiple events to ensure all pages refresh
      window.dispatchEvent(new CustomEvent('swapCompleted'));
      window.dispatchEvent(new Event('swapCompleted'));
      
      // Also trigger skillsUpdated to refresh dashboard matches
      window.dispatchEvent(new Event('skillsUpdated'));
      
      // Navigate to dashboard to see updated matches
      setTimeout(() => {
        navigate('/dashboard');
      }, 1000);
    } catch (error) {
      console.error('Error completing swap:', error);
      alert(error.response?.data?.error || 'Failed to complete swap');
    }
  };

  if (loading) {
    return <div className="loading">Loading swap details...</div>;
  }

  if (!swapData?.swap_session) {
    return <div className="empty-state">Swap session not found</div>;
  }

  const swap = swapData.swap_session;
  const otherUser = user.id === swap.user1_id 
    ? { id: swap.user2_id, username: swap.user2_username, name: swap.user2_name }
    : { id: swap.user1_id, username: swap.user1_username, name: swap.user1_name };

  return (
    <div className="container">
      {/* Completed Swap Actions - Show at top if completed */}
      {swap.status === 'COMPLETED' && (
        <div className="card" style={{ marginBottom: '20px', backgroundColor: 'rgba(40, 167, 69, 0.1)', border: '1px solid rgba(40, 167, 69, 0.3)' }}>
          <div style={{ textAlign: 'center' }}>
            <h2 style={{ color: '#28a745', marginBottom: '10px' }}>✓ Swap Completed</h2>
            {swap.completed_at && (
              <p style={{ color: '#6c757d', fontSize: '14px', marginBottom: '15px' }}>
                Completed on: {new Date(swap.completed_at).toLocaleDateString()}
              </p>
            )}
            <p style={{ color: '#155724', fontSize: '14px', marginBottom: '20px' }}>
              Both users can view chat history and swap details. You can rate each other on the Dashboard!
            </p>
            <div style={{ display: 'flex', gap: '15px', justifyContent: 'center', flexWrap: 'wrap' }}>
              <button 
                className="btn btn-secondary" 
                onClick={() => navigate('/dashboard')}
                style={{ minWidth: '200px' }}
              >
                Start New Swap
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="page-header">
        <h1>{swap.status === 'COMPLETED' ? 'Completed Swap' : 'Active Swap'} with {otherUser.name || otherUser.username}</h1>
        <p>You're swapping skills: {swap.user1_id === user.id ? swap.user1_skill_name : swap.user2_skill_name} ↔ {swap.user1_id === user.id ? swap.user2_skill_name : swap.user1_skill_name}</p>
      </div>

      {/* Tabs */}
      <div style={{ marginBottom: '20px', borderBottom: '2px solid #ddd' }}>
        <button
          className={`btn ${activeTab === 'sessions' ? 'btn-primary' : 'btn-outline'}`}
          onClick={() => setActiveTab('sessions')}
          style={{ marginRight: '10px', borderRadius: '5px 5px 0 0' }}
        >
          Learning Sessions
        </button>
        <button
          className={`btn ${activeTab === 'resources' ? 'btn-primary' : 'btn-outline'}`}
          onClick={() => setActiveTab('resources')}
          style={{ marginRight: '10px', borderRadius: '5px 5px 0 0' }}
        >
          Resources
        </button>
        <button
          className={`btn ${activeTab === 'chat' ? 'btn-primary' : 'btn-outline'}`}
          onClick={() => setActiveTab('chat')}
          style={{ borderRadius: '5px 5px 0 0' }}
        >
          Chat {swap.status === 'COMPLETED' && '(History)'}
        </button>
      </div>

      {/* Sessions Tab */}
      {activeTab === 'sessions' && (
        <div>
          <div className="card">
            <h2>Schedule a Learning Session {swap.status === 'COMPLETED' && '(Completed - View Only)'}</h2>
            {swap.status === 'COMPLETED' ? (
              <div style={{ padding: '20px', backgroundColor: 'rgba(108, 117, 125, 0.1)', borderRadius: '8px', textAlign: 'center', color: '#6c757d' }}>
                <p>This swap is completed. You can view past sessions below, but cannot create new ones.</p>
              </div>
            ) : (
            <form onSubmit={handleCreateSession}>
              <div className="form-group">
                <label>Topic *</label>
                <input
                  type="text"
                  value={sessionForm.topic}
                  onChange={(e) => setSessionForm({ ...sessionForm, topic: e.target.value })}
                  required
                  placeholder="e.g., Introduction to React Hooks"
                />
              </div>
              <div className="form-group">
                <label>Session Type *</label>
                <select
                  value={sessionForm.session_type}
                  onChange={(e) => setSessionForm({ ...sessionForm, session_type: e.target.value, meeting_link: '', place: '' })}
                  required
                >
                  <option value="Online">Online</option>
                  <option value="Offline">Offline</option>
                </select>
              </div>
              {sessionForm.session_type === 'Online' && (
                <div className="form-group">
                  <label>Meeting Link *</label>
                  <input
                    type="url"
                    value={sessionForm.meeting_link}
                    onChange={(e) => setSessionForm({ ...sessionForm, meeting_link: e.target.value })}
                    required={sessionForm.session_type === 'Online'}
                    placeholder="https://meet.google.com/xxx-xxxx-xxx or Zoom link"
                  />
                  <small style={{ color: '#6c757d', fontSize: '13px', marginTop: '4px', display: 'block' }}>
                    Enter the meeting link (Google Meet, Zoom, etc.)
                  </small>
                </div>
              )}
              {sessionForm.session_type === 'Offline' && (
                <div className="form-group">
                  <label>Meeting Place/Location *</label>
                  <input
                    type="text"
                    value={sessionForm.place}
                    onChange={(e) => setSessionForm({ ...sessionForm, place: e.target.value })}
                    required={sessionForm.session_type === 'Offline'}
                    placeholder="e.g., Coffee Shop Downtown, Library, Office Address"
                  />
                  <small style={{ color: '#6c757d', fontSize: '13px', marginTop: '4px', display: 'block' }}>
                    Enter the physical location where the session will take place
                  </small>
                </div>
              )}
              <div className="form-group">
                <label>Scheduled Date & Time *</label>
                <input
                  type="datetime-local"
                  value={sessionForm.scheduled_date}
                  onChange={(e) => setSessionForm({ ...sessionForm, scheduled_date: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label>Duration (hours)</label>
                <input
                  type="number"
                  min="0.5"
                  step="0.5"
                  value={sessionForm.duration_hours}
                  onChange={(e) => setSessionForm({ ...sessionForm, duration_hours: parseFloat(e.target.value) })}
                />
              </div>
              <div className="form-group">
                <label>Notes</label>
                <textarea
                  value={sessionForm.notes}
                  onChange={(e) => setSessionForm({ ...sessionForm, notes: e.target.value })}
                  placeholder="Any additional notes or requirements..."
                  rows="3"
                />
              </div>
              <button type="submit" className="btn btn-primary">Schedule Session</button>
            </form>
            )}
          </div>

          <div className="card">
            <h2>Scheduled Sessions</h2>
            {swapData.learning_sessions?.length === 0 ? (
              <p style={{ color: '#666' }}>No sessions scheduled yet</p>
            ) : (
              <div>
                {swapData.learning_sessions?.map((session) => (
                  <div key={session.id} className="match-card" style={{ marginBottom: '15px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                      <div>
                        <h3>{session.topic}</h3>
                        <div className="session-meta">
                          <span><strong>Type:</strong> {session.session_type}</span>
                          <span><strong>Date:</strong> {new Date(session.scheduled_date).toLocaleString()}</span>
                          <span><strong>Duration:</strong> {session.duration_hours} hours</span>
                        </div>
                        {session.session_type === 'Online' && session.meeting_link && (
                          <p style={{ marginTop: '8px', marginBottom: '8px' }}>
                            <strong>Meeting Link:</strong>{' '}
                            <a href={session.meeting_link} target="_blank" rel="noopener noreferrer" style={{ color: '#007bff', textDecoration: 'underline' }}>
                              Join Meeting
                            </a>
                          </p>
                        )}
                        {session.session_type === 'Offline' && session.place && (
                          <p style={{ marginTop: '8px', marginBottom: '8px' }}>
                            <strong>Location:</strong> {session.place}
                          </p>
                        )}
                        <p><strong>Teacher:</strong> {session.teacher_id === user.id ? 'You' : (session.teacher_username || 'User')}</p>
                        <p><strong>Student:</strong> {session.student_id === user.id ? 'You' : (session.student_username || 'User')}</p>
                        <p>
                          <strong>Status:</strong> 
                          <span className={`badge badge-${session.status.toLowerCase()}`}>{session.status}</span>
                        </p>
                        {session.notes && <p style={{ marginTop: '8px' }}><strong>Notes:</strong> {session.notes}</p>}
                      </div>
                      <div>
                        {session.status === 'SCHEDULED' && session.student_id === user.id && (
                          <button
                            className="btn btn-primary"
                            onClick={() => handleUpdateSessionStatus(session.id, 'COMPLETED')}
                          >
                            Mark Completed
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Resources Tab */}
      {activeTab === 'resources' && (
        <div>
          <div className="card">
            <h2>Share a Resource {swap.status === 'COMPLETED' && '(Completed - View Only)'}</h2>
            {swap.status === 'COMPLETED' ? (
              <div style={{ padding: '20px', backgroundColor: 'rgba(108, 117, 125, 0.1)', borderRadius: '8px', textAlign: 'center', color: '#6c757d' }}>
                <p>This swap is completed. You can view past resources below, but cannot add new ones.</p>
              </div>
            ) : (
            <form onSubmit={handleAddResource}>
              <div className="form-group">
                <label>Resource Type *</label>
                <select
                  value={resourceForm.resource_type}
                  onChange={(e) => setResourceForm({ ...resourceForm, resource_type: e.target.value })}
                  required
                >
                  <option value="Link">Link</option>
                  <option value="PDF">PDF</option>
                  <option value="Note">Note</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              <div className="form-group">
                <label>Title *</label>
                <input
                  type="text"
                  value={resourceForm.title}
                  onChange={(e) => setResourceForm({ ...resourceForm, title: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label>Content / URL</label>
                <textarea
                  value={resourceForm.content}
                  onChange={(e) => setResourceForm({ ...resourceForm, content: e.target.value })}
                  placeholder="Paste URL or write notes..."
                />
              </div>
              <button type="submit" className="btn btn-primary">Add Resource</button>
            </form>
            )}
          </div>

          <div className="card">
            <h2>Shared Resources</h2>
            {swapData.resources?.length === 0 ? (
              <p style={{ color: '#666' }}>No resources shared yet</p>
            ) : (
              <div>
                {swapData.resources?.map((resource) => (
                  <div key={resource.id} className="match-card" style={{ marginBottom: '15px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                      <div>
                        <h3>{resource.title}</h3>
                        <p><strong>Type:</strong> {resource.resource_type}</p>
                        <p><strong>Shared by:</strong> {resource.uploaded_by_username}</p>
                        <p><strong>Date:</strong> {new Date(resource.created_at).toLocaleString()}</p>
                        {resource.content && (
                          <div style={{ marginTop: '10px', padding: '10px', backgroundColor: '#f5f5f5', borderRadius: '5px' }}>
                            {resource.resource_type === 'Link' ? (
                              <a href={resource.content} target="_blank" rel="noopener noreferrer">{resource.content}</a>
                            ) : (
                              <p>{resource.content}</p>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Chat Tab */}
      {activeTab === 'chat' && (
        <div className="card">
          <h2>Chat with {otherUser.name || otherUser.username}</h2>
          <div style={{ border: '1px solid #ddd', borderRadius: '5px', padding: '15px', marginBottom: '15px', minHeight: '400px', maxHeight: '400px', overflowY: 'auto' }}>
            {swapData.messages?.length === 0 ? (
              <p style={{ color: '#666', textAlign: 'center' }}>No messages yet. Start the conversation!</p>
            ) : (
              swapData.messages?.map((message) => (
                <div
                  key={message.id}
                  style={{
                    marginBottom: '15px',
                    padding: '10px',
                    backgroundColor: message.sender_id === user.id ? '#e3f2fd' : '#f5f5f5',
                    borderRadius: '5px',
                    textAlign: message.sender_id === user.id ? 'right' : 'left'
                  }}
                >
                  <div style={{ fontSize: '12px', color: '#666', marginBottom: '5px' }}>
                    {message.sender_username} - {new Date(message.created_at).toLocaleString()}
                  </div>
                  <div>{message.message_text}</div>
                </div>
              ))
            )}
          </div>
          {/* Always allow chat, even for completed swaps */}
          <form onSubmit={handleSendMessage}>
            <div style={{ display: 'flex', gap: '10px' }}>
              <input
                type="text"
                value={messageText}
                onChange={(e) => setMessageText(e.target.value)}
                placeholder="Type your message..."
                style={{ flex: 1, padding: '10px', border: '1px solid #ddd', borderRadius: '5px' }}
              />
              <button type="submit" className="btn btn-primary">Send</button>
            </div>
          </form>
          {swap.status === 'COMPLETED' && (
            <p style={{ marginTop: '10px', fontSize: '12px', color: '#6c757d', textAlign: 'center' }}>
              Swap completed, but you can still continue chatting with {otherUser.name || otherUser.username}
            </p>
          )}
        </div>
      )}

      {/* Complete Swap Button - Only show if ACTIVE */}
      {swap.status === 'ACTIVE' && (
        <div className="card" style={{ marginTop: '20px', textAlign: 'center' }}>
          <button className="btn btn-primary" onClick={handleCompleteSwap}>
            Mark Swap as Completed
          </button>
          <p style={{ marginTop: '10px', color: '#6c757d', fontSize: '14px' }}>
            When you mark this swap as completed, both users will see it as completed.
          </p>
        </div>
      )}

      {/* Completed Swap Actions */}
      {swap.status === 'COMPLETED' && (
        <div className="card" style={{ marginTop: '20px', backgroundColor: 'rgba(40, 167, 69, 0.1)', border: '1px solid rgba(40, 167, 69, 0.3)' }}>
          <div style={{ textAlign: 'center', marginBottom: '20px' }}>
            <h2 style={{ color: '#28a745' }}>✓ Swap Completed</h2>
            {swap.completed_at && (
              <p style={{ color: '#6c757d', fontSize: '14px' }}>
                Completed on: {new Date(swap.completed_at).toLocaleDateString()}
              </p>
            )}
          </div>
          
          <div style={{ display: 'flex', gap: '15px', justifyContent: 'center', flexWrap: 'wrap' }}>
            <button 
              className="btn btn-secondary" 
              onClick={() => navigate('/dashboard')}
              style={{ minWidth: '200px' }}
            >
              Start New Swap
            </button>
          </div>
          
          <p style={{ marginTop: '20px', textAlign: 'center', color: '#6c757d', fontSize: '14px' }}>
            All resources, chat history, and swap details are preserved above. You can continue chatting, review this swap, or start a new one!
          </p>
        </div>
      )}
    </div>
  );
};

export default ActiveSwap;

