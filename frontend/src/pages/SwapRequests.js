import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from '../utils/axiosConfig';
import { useAuth } from '../context/AuthContext';

const SwapRequests = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [swapRequests, setSwapRequests] = useState({ sent: [], received: [] });
  const [completedSwaps, setCompletedSwaps] = useState([]);
  const [completedSwapsDetails, setCompletedSwapsDetails] = useState({}); // { swapId: { resources: [], messages: [] } }
  const [expandedSwap, setExpandedSwap] = useState(null); // ID of expanded swap
  const [newMessages, setNewMessages] = useState({}); // { swapId: messageText } For sending new messages per swap
  const [activeTab, setActiveTab] = useState('received');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.id) return;
    
    fetchSwapRequests();
    
    // Refresh when page comes into focus (e.g., after completing a swap)
    const handleFocus = () => {
      console.log('Page focused, refreshing swap requests...');
      fetchSwapRequests();
    };
    
    // Listen for swap completion event
    const handleSwapCompleted = () => {
      console.log('Swap completed event received, refreshing swap requests...');
      setTimeout(() => {
        fetchSwapRequests();
      }, 1500);
    };
    
    // Also listen for visibility change
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        console.log('Page became visible, refreshing swap requests...');
        fetchSwapRequests();
      }
    };
    
    window.addEventListener('focus', handleFocus);
    window.addEventListener('swapCompleted', handleSwapCompleted);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('swapCompleted', handleSwapCompleted);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [user?.id]);

  const fetchSwapRequests = async () => {
    if (!user?.id) {
      console.log('No user ID, skipping fetch');
      return;
    }
    
    try {
      setLoading(true);
      const [sentResponse, receivedResponse, swapsResponse] = await Promise.all([
        axios.get('/api/swap-requests?type=sent'),
        axios.get('/api/swap-requests?type=received'),
        axios.get('/api/swap-sessions')
      ]);
      
      setSwapRequests({
        sent: sentResponse.data.swap_requests || [],
        received: receivedResponse.data.swap_requests || []
      });
      
      // Get completed swaps - backend already deduplicates, so just filter for COMPLETED status
      const allSwaps = swapsResponse.data.swap_sessions || [];
      console.log('All swaps from API (SwapRequests):', allSwaps);
      console.log('Current user ID:', user.id, 'Type:', typeof user.id);
      
      const completed = allSwaps.filter(swap => {
        const isCompleted = swap.status === 'COMPLETED';
        const belongsToUser = parseInt(swap.user1_id) === parseInt(user.id) || parseInt(swap.user2_id) === parseInt(user.id);
        console.log(`Swap ${swap.id}: status=${swap.status}, user1=${swap.user1_id}, user2=${swap.user2_id}, belongsToUser=${belongsToUser}`);
        return isCompleted && belongsToUser;
      });
      
      console.log('Completed swaps filtered (SwapRequests):', completed);
      console.log('Setting completed swaps count:', completed.length);
      setCompletedSwaps(completed);
      
      // Fetch details (resources and messages) for all completed swaps
      const detailsPromises = completed.map(swap => 
        axios.get(`/api/swap-sessions/${swap.id}`)
          .then(response => ({
            swapId: swap.id,
            data: response.data
          }))
          .catch(error => {
            console.error(`Error fetching details for swap ${swap.id}:`, error);
            return { swapId: swap.id, data: { resources: [], messages: [] } };
          })
      );
      
      const detailsResults = await Promise.all(detailsPromises);
      const detailsMap = {};
      detailsResults.forEach(result => {
        detailsMap[result.swapId] = {
          resources: result.data.resources || [],
          messages: result.data.messages || []
        };
      });
      setCompletedSwapsDetails(detailsMap);
    } catch (error) {
      console.error('Error fetching swap requests:', error);
      console.error('Error details:', error.response?.data);
      setCompletedSwaps([]);
    } finally {
      setLoading(false);
    }
  };

  const handleAccept = async (requestId) => {
    try {
      await axios.post(`/api/swap-requests/${requestId}/accept`);
      alert('Swap request accepted! An active swap session has been created.');
      fetchSwapRequests();
      window.location.href = '/dashboard';
    } catch (error) {
      alert(error.response?.data?.error || 'Failed to accept swap request');
    }
  };

  const handleReject = async (requestId) => {
    if (!window.confirm('Are you sure you want to reject this swap request?')) return;
    try {
      await axios.post(`/api/swap-requests/${requestId}/reject`);
      alert('Swap request rejected');
      fetchSwapRequests();
    } catch (error) {
      alert(error.response?.data?.error || 'Failed to reject swap request');
    }
  };

  const handleSendMessage = async (swapId) => {
    const messageText = newMessages[swapId] || '';
    if (!messageText.trim()) {
      alert('Please enter a message');
      return;
    }

    try {
      await axios.post('/api/messages', {
        swap_session_id: swapId,
        message_text: messageText.trim()
      });
      
      // Clear message input for this swap
      setNewMessages(prev => ({ ...prev, [swapId]: '' }));
      
      // Refresh swap details to get new message
      const response = await axios.get(`/api/swap-sessions/${swapId}`);
      setCompletedSwapsDetails(prev => ({
        ...prev,
        [swapId]: {
          resources: response.data.resources || [],
          messages: response.data.messages || []
        }
      }));
    } catch (error) {
      alert(error.response?.data?.error || 'Failed to send message');
    }
  };

  const toggleExpandSwap = (swapId) => {
    setExpandedSwap(expandedSwap === swapId ? null : swapId);
  };

  if (loading) {
    return <div className="loading">Loading swap requests...</div>;
  }

  const getRequestsForTab = () => {
    if (activeTab === 'sent') return swapRequests.sent;
    if (activeTab === 'received') return swapRequests.received;
    if (activeTab === 'completed') return completedSwaps;
    return [];
  };

  const requests = getRequestsForTab();

  return (
    <div className="container">
      <div className="page-header">
        <h1>Swap Requests</h1>
        <p>Manage your swap requests and view completed swaps</p>
      </div>

      <div style={{ marginBottom: '20px', display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
        <button
          className={`btn ${activeTab === 'received' ? 'btn-primary' : 'btn-outline'}`}
          onClick={() => setActiveTab('received')}
        >
          Received ({swapRequests.received.length})
        </button>
        <button
          className={`btn ${activeTab === 'sent' ? 'btn-primary' : 'btn-outline'}`}
          onClick={() => setActiveTab('sent')}
        >
          Sent ({swapRequests.sent.length})
        </button>
        <button
          className={`btn ${activeTab === 'completed' ? 'btn-primary' : 'btn-outline'}`}
          onClick={() => {
            setActiveTab('completed');
            // Refresh when switching to completed tab
            fetchSwapRequests();
          }}
          style={{ backgroundColor: activeTab === 'completed' ? 'rgba(40, 167, 69, 0.8)' : 'transparent' }}
        >
          Completed ({completedSwaps.length})
        </button>
      </div>

      {requests.length === 0 ? (
        <div className="empty-state">
          <h3>No {activeTab === 'completed' ? 'completed swaps' : `${activeTab} swap requests`}</h3>
        </div>
      ) : (
        <div className="grid">
          {requests.map((request) => {
            // For completed swaps, render differently with inline resources and chat
            if (activeTab === 'completed') {
              const otherUser = parseInt(request.user1_id) === parseInt(user.id) 
                ? { 
                    id: request.user2_id,
                    username: request.user2_username, 
                    name: request.user2_name 
                  }
                : { 
                    id: request.user1_id,
                    username: request.user1_username, 
                    name: request.user1_name 
                  };
              
              const swapDetails = completedSwapsDetails[request.id] || { resources: [], messages: [] };
              const isExpanded = expandedSwap === request.id;
              
              return (
                <div 
                  key={request.id} 
                  className="match-card"
                  style={{
                    opacity: 0.9,
                    backgroundColor: 'rgba(40, 167, 69, 0.1)',
                    border: '1px solid rgba(40, 167, 69, 0.3)',
                    transition: 'all 0.3s ease'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '15px' }}>
                    <div>
                      <h3>Swap with {otherUser.name || otherUser.username}</h3>
                      <span className="badge badge-completed" style={{ marginTop: '5px', display: 'inline-block' }}>
                        COMPLETED
                      </span>
                    </div>
                    <button
                      className="btn btn-outline"
                      onClick={() => toggleExpandSwap(request.id)}
                      style={{ padding: '5px 15px', fontSize: '14px' }}
                    >
                      {isExpanded ? '▼ Hide' : '▶ Show'} Resources & Chat
                    </button>
                  </div>

                  <div style={{ marginBottom: '15px' }}>
                    <p><strong>You learned:</strong></p>
                    <p className="skill-tag offer" style={{ display: 'inline-block', marginTop: '5px' }}>
                      {parseInt(request.user1_id) === parseInt(user.id) ? request.user2_skill_name : request.user1_skill_name}
                    </p>
                  </div>

                  <div style={{ marginBottom: '15px' }}>
                    <p><strong>You taught:</strong></p>
                    <p className="skill-tag want" style={{ display: 'inline-block', marginTop: '5px' }}>
                      {parseInt(request.user1_id) === parseInt(user.id) ? request.user1_skill_name : request.user2_skill_name}
                    </p>
                  </div>

                  {request.completed_at && (
                    <p style={{ fontSize: '12px', color: '#6c757d', marginBottom: '15px' }}>
                      Completed on: {new Date(request.completed_at).toLocaleDateString()}
                    </p>
                  )}

                  {/* Expanded Resources & Chat Section */}
                  {isExpanded && (
                    <div style={{ 
                      marginTop: '20px', 
                      padding: '15px', 
                      backgroundColor: 'rgba(255, 255, 255, 0.05)', 
                      borderRadius: '8px',
                      borderTop: '2px solid rgba(40, 167, 69, 0.3)'
                    }}>
                      {/* Resources Section */}
                      <div style={{ marginBottom: '25px' }}>
                        <h4 style={{ marginBottom: '15px', color: '#28a745' }}>📎 Resources Shared</h4>
                        {swapDetails.resources && swapDetails.resources.length > 0 ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            {swapDetails.resources.map((resource) => (
                              <div 
                                key={resource.id}
                                style={{
                                  padding: '12px',
                                  backgroundColor: 'rgba(255, 255, 255, 0.08)',
                                  borderRadius: '6px',
                                  borderLeft: '3px solid #28a745'
                                }}
                              >
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '5px' }}>
                                  <strong style={{ color: '#fff' }}>{resource.title}</strong>
                                  <span style={{ fontSize: '12px', color: '#6c757d' }}>
                                    {resource.uploaded_by_username}
                                  </span>
                                </div>
                                <div style={{ fontSize: '12px', color: '#6c757d', marginBottom: '5px' }}>
                                  Type: {resource.resource_type}
                                </div>
                                {resource.content && (
                                  <div style={{ fontSize: '14px', color: '#ccc', marginTop: '5px' }}>
                                    {resource.content}
                                  </div>
                                )}
                                {resource.file_path && (
                                  <a 
                                    href={`http://localhost:5001${resource.file_path}`} 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    style={{ color: '#4CAF50', fontSize: '14px', textDecoration: 'underline' }}
                                  >
                                    View File
                                  </a>
                                )}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p style={{ color: '#6c757d', fontStyle: 'italic' }}>No resources shared yet.</p>
                        )}
                      </div>

                      {/* Chat Section */}
                      <div>
                        <h4 style={{ marginBottom: '15px', color: '#28a745' }}>💬 Chat History</h4>
                        <div style={{
                          maxHeight: '300px',
                          overflowY: 'auto',
                          backgroundColor: 'rgba(0, 0, 0, 0.2)',
                          borderRadius: '6px',
                          padding: '15px',
                          marginBottom: '15px',
                          border: '1px solid rgba(255, 255, 255, 0.1)'
                        }}>
                          {swapDetails.messages && swapDetails.messages.length > 0 ? (
                            swapDetails.messages.map((message) => (
                              <div
                                key={message.id}
                                style={{
                                  marginBottom: '15px',
                                  padding: '10px',
                                  borderRadius: '8px',
                                  backgroundColor: parseInt(message.sender_id) === parseInt(user.id) 
                                    ? 'rgba(76, 175, 80, 0.2)' 
                                    : 'rgba(33, 150, 243, 0.2)',
                                  alignSelf: parseInt(message.sender_id) === parseInt(user.id) ? 'flex-end' : 'flex-start',
                                  marginLeft: parseInt(message.sender_id) === parseInt(user.id) ? 'auto' : '0',
                                  maxWidth: '70%'
                                }}
                              >
                                <div style={{ fontSize: '12px', color: '#aaa', marginBottom: '5px' }}>
                                  {message.sender_username} • {new Date(message.created_at).toLocaleString()}
                                </div>
                                <div style={{ color: '#fff' }}>{message.message_text}</div>
                              </div>
                            ))
                          ) : (
                            <p style={{ color: '#6c757d', fontStyle: 'italic', textAlign: 'center' }}>
                              No messages yet. Start the conversation!
                            </p>
                          )}
                        </div>

                        {/* Chat Input */}
                        <div style={{ display: 'flex', gap: '10px' }}>
                          <input
                            type="text"
                            placeholder="Type a message..."
                            value={newMessages[request.id] || ''}
                            onChange={(e) => {
                              setNewMessages(prev => ({ ...prev, [request.id]: e.target.value }));
                            }}
                            onKeyPress={(e) => {
                              if (e.key === 'Enter') {
                                handleSendMessage(request.id);
                              }
                            }}
                            style={{
                              flex: 1,
                              padding: '10px',
                              borderRadius: '6px',
                              border: '1px solid rgba(255, 255, 255, 0.2)',
                              backgroundColor: 'rgba(255, 255, 255, 0.1)',
                              color: '#fff',
                              fontSize: '14px'
                            }}
                          />
                          <button
                            className="btn btn-primary"
                            onClick={() => handleSendMessage(request.id)}
                            disabled={!newMessages[request.id]?.trim()}
                            style={{ padding: '10px 20px' }}
                          >
                            Send
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            }

            // For sent/received requests, render normally
            return (
              <div key={request.id} className="match-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '15px' }}>
                  <div>
                    <h3>
                      {activeTab === 'received' 
                        ? request.requester_username || request.requester_name
                        : request.receiver_username || request.receiver_name}
                    </h3>
                    <span className={`skill-tag ${request.status === 'PENDING' ? 'want' : request.status === 'ACCEPTED' ? 'offer' : ''}`}>
                      {request.status}
                    </span>
                  </div>
                </div>

                <div style={{ marginBottom: '15px' }}>
                  <p><strong>You {activeTab === 'received' ? 'will teach' : 'are teaching'}:</strong></p>
                  <p className="skill-tag offer" style={{ display: 'inline-block', marginTop: '5px' }}>
                    {activeTab === 'received' ? request.receiver_skill_name : request.requester_skill_name}
                  </p>
                </div>

                <div style={{ marginBottom: '15px' }}>
                  <p><strong>You {activeTab === 'received' ? 'will learn' : 'will learn'}:</strong></p>
                  <p className="skill-tag want" style={{ display: 'inline-block', marginTop: '5px' }}>
                    {activeTab === 'received' ? request.requester_skill_name : request.receiver_skill_name}
                  </p>
                </div>

                {request.message && (
                  <div style={{ marginBottom: '15px', padding: '10px', backgroundColor: 'rgba(255, 255, 255, 0.05)', borderRadius: '5px' }}>
                    <strong>Message:</strong> {request.message}
                  </div>
                )}

                <p style={{ fontSize: '12px', color: '#6c757d', marginBottom: '15px' }}>
                  {new Date(request.created_at).toLocaleDateString()}
                </p>

                {activeTab === 'received' && request.status === 'PENDING' && (
                  <div>
                    <button
                      className="btn btn-primary"
                      onClick={() => handleAccept(request.id)}
                      style={{ marginRight: '10px' }}
                    >
                      Accept
                    </button>
                    <button
                      className="btn btn-danger"
                      onClick={() => handleReject(request.id)}
                    >
                      Reject
                    </button>
                  </div>
                )}

                {request.status === 'ACCEPTED' && (
                  <div className="success">
                    ✓ Swap request accepted! Check your active swaps on the dashboard.
                  </div>
                )}

                {request.status === 'REJECTED' && (
                  <div style={{ color: '#f44336' }}>
                    ✗ This swap request was rejected
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default SwapRequests;

