import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from '../utils/axiosConfig';
import { useAuth } from '../context/AuthContext';

const Dashboard = () => {
  const { user } = useAuth();
  const [matches, setMatches] = useState([]);
  const [activeSwaps, setActiveSwaps] = useState([]);
  const [sentRequests, setSentRequests] = useState([]);
  const [receivedRequests, setReceivedRequests] = useState([]);
  const [completedSwaps, setCompletedSwaps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [ratingModal, setRatingModal] = useState(null); // { userId, userName, currentRating, swapId? }
  const [selectedRating, setSelectedRating] = useState(0);
  const [hoveredRating, setHoveredRating] = useState(0);
  const navigate = useNavigate();

  const getRequestStatus = useCallback((matchedUserId, sentReqs, receivedReqs, active, completed) => {
    // FIRST: Check if there's a completed swap with this user (highest priority for rating)
    const completedSwap = (completed || []).find(swap => 
      (parseInt(swap.user1_id) === parseInt(matchedUserId) && parseInt(swap.user2_id) === parseInt(user?.id)) ||
      (parseInt(swap.user2_id) === parseInt(matchedUserId) && parseInt(swap.user1_id) === parseInt(user?.id))
    );
    if (completedSwap) {
      return { status: 'COMPLETED', hasRequest: false, allowNewRequest: true, pendingRequestId: null, completedSwapId: completedSwap.id };
    }
    
    // SECOND: Check if there's an active swap with this user - show ACTIVE status with Complete button
    const activeSwap = (active || []).find(swap => 
      (parseInt(swap.user1_id) === parseInt(matchedUserId) && parseInt(swap.user2_id) === parseInt(user?.id)) ||
      (parseInt(swap.user2_id) === parseInt(matchedUserId) && parseInt(swap.user1_id) === parseInt(user?.id))
    );
    if (activeSwap) {
      return { status: 'ACTIVE', hasRequest: true, allowNewRequest: false, pendingRequestId: null, activeSwapId: activeSwap.id };
    }
    
    // THIRD: Check if current user RECEIVED a pending request FROM the matched user
    // This means matched user sent a request to current user - show Accept/Reject
    const receivedPendingRequest = (receivedReqs || []).find(req => 
      parseInt(req.requester_id) === parseInt(matchedUserId) && req.status === 'PENDING'
    );
    
    if (receivedPendingRequest) {
      return { 
        status: 'RECEIVED_PENDING', 
        hasRequest: true, 
        allowNewRequest: false,
        pendingRequestId: receivedPendingRequest.id,
        isReceivedRequest: true
      };
    }
    
    // FOURTH: Check if current user SENT a request TO the matched user
    const sentRequest = (sentReqs || []).find(req => 
      parseInt(req.receiver_id) === parseInt(matchedUserId)
    );
    
    if (sentRequest) {
      if (sentRequest.status === 'ACCEPTED') {
        // Accepted means active swap exists - check active swaps again to get swap ID
        const activeSwapAfterAccept = (active || []).find(swap => 
          (parseInt(swap.user1_id) === parseInt(matchedUserId) && parseInt(swap.user2_id) === parseInt(user?.id)) ||
          (parseInt(swap.user2_id) === parseInt(matchedUserId) && parseInt(swap.user1_id) === parseInt(user?.id))
        );
        if (activeSwapAfterAccept) {
          return { status: 'ACTIVE', hasRequest: true, allowNewRequest: false, pendingRequestId: null, activeSwapId: activeSwapAfterAccept.id };
        }
        return { status: null, hasRequest: true, allowNewRequest: true, pendingRequestId: null };
      } else if (sentRequest.status === 'REJECTED') {
        // Rejected request - allow new request
        return { status: 'REJECTED', hasRequest: true, allowNewRequest: true, pendingRequestId: null };
      } else {
        // PENDING request sent by current user - show pending status
        return { status: 'PENDING', hasRequest: true, allowNewRequest: false, pendingRequestId: null };
      }
    }
    
    // No previous interaction - allow new request
    return { status: null, hasRequest: false, allowNewRequest: true, pendingRequestId: null };
  }, [user?.id]);

  const fetchSentRequests = useCallback(async () => {
    try {
      const response = await axios.get('/api/swap-requests?type=sent');
      setSentRequests(response.data.swap_requests || []);
      return response.data.swap_requests || [];
    } catch (error) {
      console.error('Error fetching sent requests:', error);
      return [];
    }
  }, []);

  const fetchReceivedRequests = useCallback(async () => {
    try {
      const response = await axios.get('/api/swap-requests?type=received');
      setReceivedRequests(response.data.swap_requests || []);
      return response.data.swap_requests || [];
    } catch (error) {
      console.error('Error fetching received requests:', error);
      return [];
    }
  }, []);

  const fetchMatchesWithRequests = useCallback(async (sentReqs, receivedReqs, active, completed) => {
    try {
      const response = await axios.get('/api/matching/matches');
      const matchesData = response.data.matches || [];
      // Mark matches with their request status
      const matchesWithStatus = matchesData.map(match => {
        const statusInfo = getRequestStatus(match.user.id, sentReqs, receivedReqs, active, completed);
        return {
          ...match,
          requestStatus: statusInfo.status,
          hasRequest: statusInfo.hasRequest,
          allowNewRequest: statusInfo.allowNewRequest,
          pendingRequestId: statusInfo.pendingRequestId,
          isReceivedRequest: statusInfo.isReceivedRequest || false
        };
      });
      setMatches(matchesWithStatus);
    } catch (error) {
      console.error('Error fetching matches:', error);
    }
  }, [getRequestStatus]);

  const loadDashboardData = useCallback(async () => {
    setLoading(true);
      try {
        // Fetch in parallel, then use results
        const [sentReqs, receivedReqs, swapsResponse] = await Promise.all([
          fetchSentRequests(),
          fetchReceivedRequests(),
          axios.get('/api/swap-sessions').catch(() => ({ data: { swap_sessions: [] } }))
        ]);
      
      const allSwaps = swapsResponse.data.swap_sessions || [];
      console.log('All swaps from API:', allSwaps);
      
      const active = allSwaps.filter(swap => swap.status === 'ACTIVE');
      const completed = allSwaps.filter(swap => swap.status === 'COMPLETED');
      
      console.log('Active swaps:', active);
      console.log('Completed swaps (before dedup):', completed);
      
      // Deduplicate completed swaps (keep most recent)
      const completedMap = new Map();
      completed.forEach(swap => {
        const pairKey = [parseInt(swap.user1_id), parseInt(swap.user2_id)].sort().join('-');
        const existing = completedMap.get(pairKey);
        if (!existing || new Date(swap.completed_at || 0) > new Date(existing.completed_at || 0)) {
          completedMap.set(pairKey, swap);
        }
      });
      const uniqueCompleted = Array.from(completedMap.values());
      
      console.log('Unique completed swaps:', uniqueCompleted);
      
        setActiveSwaps(active);
        setCompletedSwaps(uniqueCompleted);
        
        // Now fetch matches with all the data
        await fetchMatchesWithRequests(sentReqs, receivedReqs, active, uniqueCompleted);
    } catch (error) {
      console.error('Error loading dashboard data:', error);
      // Set empty arrays on error so dashboard still renders
      setMatches([]);
      setActiveSwaps([]);
      setSentRequests([]);
      setReceivedRequests([]);
      setCompletedSwaps([]);
    } finally {
      setLoading(false);
    }
  }, [fetchSentRequests, fetchReceivedRequests, fetchMatchesWithRequests]);

  useEffect(() => {
    if (!user?.id) {
      setLoading(false);
      return;
    }
    
    let isMounted = true;
    
    const loadData = async () => {
      if (!isMounted) return;
      await loadDashboardData();
    };
    
    loadData();
    
    // Listen for skills update event
    const handleSkillsUpdate = () => {
      console.log('Skills updated, refreshing dashboard...');
      if (isMounted) {
        loadDashboardData();
      }
    };
    
    // Listen for swap completed event
    const handleSwapCompleted = () => {
      console.log('Swap completed event received, refreshing dashboard...');
      if (isMounted) {
        setTimeout(() => {
          if (isMounted) {
            loadDashboardData();
          }
        }, 1500);
      }
    };
    
    window.addEventListener('skillsUpdated', handleSkillsUpdate);
    window.addEventListener('swapCompleted', handleSwapCompleted);
    
    return () => {
      isMounted = false;
      window.removeEventListener('skillsUpdated', handleSkillsUpdate);
      window.removeEventListener('swapCompleted', handleSwapCompleted);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);


  const handleRequestSwap = async (matchedUserId) => {
    try {
      // Fetch detailed matching info
      const response = await axios.get(`/api/matching/details/${matchedUserId}`);
      const { their_offers_that_i_want, my_offers_that_they_want, all_their_offers, all_my_offers } = response.data;
      
      // Check if at least one direction matches
      if (their_offers_that_i_want.length === 0 && my_offers_that_they_want.length === 0) {
        alert('No matching skills found');
        return;
      }

      // Determine which skills to use for the swap
      let requesterSkillId, receiverSkillId;
      let message = '';
      
      if (my_offers_that_they_want.length > 0 && their_offers_that_i_want.length > 0) {
        // Both directions match - perfect bidirectional swap
        requesterSkillId = my_offers_that_they_want[0].id;
        receiverSkillId = their_offers_that_i_want[0].id;
        message = `Hi! I'd like to swap ${my_offers_that_they_want[0].skill_name} for ${their_offers_that_i_want[0].skill_name}.`;
      } else if (their_offers_that_i_want.length > 0 && all_my_offers.length > 0) {
        // They offer something I want - use first of their offers I want and first of my offers
        receiverSkillId = their_offers_that_i_want[0].id;
        requesterSkillId = all_my_offers[0].id;
        message = `Hi! I'd like to swap ${all_my_offers[0].skill_name} for ${their_offers_that_i_want[0].skill_name}.`;
      } else if (my_offers_that_they_want.length > 0 && all_their_offers.length > 0) {
        // I offer something they want - use first of my offers they want and first of their offers
        requesterSkillId = my_offers_that_they_want[0].id;
        receiverSkillId = all_their_offers[0].id;
        message = `Hi! I'd like to swap ${my_offers_that_they_want[0].skill_name} for ${all_their_offers[0].skill_name}.`;
      } else {
        alert('Cannot create swap request. Please ensure both users have offer skills.');
        return;
      }

      await axios.post('/api/swap-requests', {
        receiver_id: matchedUserId,
        requester_skill_id: requesterSkillId,
        receiver_skill_id: receiverSkillId,
        message
      });

      alert('Swap request sent successfully!');
      
      // Refresh all data
      const [updatedSentReqs, updatedReceivedReqs, swapsResponse] = await Promise.all([
        fetchSentRequests(),
        fetchReceivedRequests(),
        axios.get('/api/swap-sessions').catch(() => ({ data: { swap_sessions: [] } }))
      ]);
      
      const allSwaps = swapsResponse.data.swap_sessions || [];
      const active = allSwaps.filter(swap => swap.status === 'ACTIVE');
      const completed = allSwaps.filter(swap => swap.status === 'COMPLETED');
      
      // Deduplicate completed swaps (keep most recent)
      const completedMap = new Map();
      completed.forEach(swap => {
        const pairKey = [parseInt(swap.user1_id), parseInt(swap.user2_id)].sort().join('-');
        const existing = completedMap.get(pairKey);
        if (!existing || new Date(swap.completed_at || 0) > new Date(existing.completed_at || 0)) {
          completedMap.set(pairKey, swap);
        }
      });
      const uniqueCompleted = Array.from(completedMap.values());
      
      setActiveSwaps(active);
      setCompletedSwaps(uniqueCompleted);
      
      // Refresh matches with updated status
      await fetchMatchesWithRequests(updatedSentReqs, updatedReceivedReqs, active, uniqueCompleted);

      alert('Swap request sent successfully!');
      // Don't navigate away, let user see the updated status
    } catch (error) {
      alert(error.response?.data?.error || 'Failed to send swap request');
    }
  };

  if (loading) {
    return <div className="loading">Loading matches...</div>;
  }

  if (!user?.id) {
    return (
      <div className="container">
        <div className="page-header">
          <h1>Dashboard</h1>
          <p>Please log in to view your dashboard</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container">
      <div className="page-header">
        <h1>Dashboard</h1>
        <p>Find users to swap skills with</p>
      </div>

      {/* Active Swaps Section */}
      {activeSwaps.length > 0 && (
        <section style={{ marginBottom: '40px' }}>
          <h2 style={{ marginBottom: '20px' }}>Active Swaps</h2>
          <div className="grid">
            {activeSwaps.map((swap) => {
              const otherUser = swap.user1_id === user.id 
                ? { username: swap.user2_username, name: swap.user2_name }
                : { username: swap.user1_username, name: swap.user1_name };
              
              return (
                <div key={swap.id} className="match-card">
                  <h3>Swap with {otherUser.name || otherUser.username}</h3>
                  <p><strong>You're learning:</strong> {swap.user1_id === user.id ? swap.user2_skill_name : swap.user1_skill_name}</p>
                  <p><strong>You're teaching:</strong> {swap.user1_id === user.id ? swap.user1_skill_name : swap.user2_skill_name}</p>
                  <button 
                    className="btn btn-primary" 
                    onClick={() => navigate(`/swap/${swap.id}`)}
                    style={{ marginTop: '15px' }}
                  >
                    View Swap Details
                  </button>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Matches Section */}
      <section>
        <h2 style={{ marginBottom: '20px' }}>Potential Matches</h2>
        {matches.length === 0 ? (
          <div className="empty-state">
            <h3>No matches found</h3>
            <p>Add more skills to your profile to find matches!</p>
          </div>
        ) : (
          <div className="grid">
            {matches.map((match) => {
              const statusInfo = getRequestStatus(match.user.id, sentRequests, receivedRequests, activeSwaps, completedSwaps);
              const requestStatus = match.requestStatus !== undefined ? match.requestStatus : statusInfo.status;
              const pendingRequestId = match.pendingRequestId !== undefined ? match.pendingRequestId : statusInfo.pendingRequestId;
              const isReceivedRequest = match.isReceivedRequest || statusInfo.isReceivedRequest || false;
              const activeSwapId = statusInfo.activeSwapId;
              
              // Determine styling based on status
              let statusStyle = {
                opacity: 1,
                backgroundColor: 'rgba(255, 255, 255, 0.1)',
                border: '1px solid rgba(255, 255, 255, 0.18)'
              };
              
              if (requestStatus === 'ACTIVE') {
                statusStyle = {
                  opacity: 0.9,
                  backgroundColor: 'rgba(40, 167, 69, 0.1)',
                  border: '1px solid rgba(40, 167, 69, 0.3)'
                };
              } else if (requestStatus === 'REJECTED') {
                statusStyle = {
                  opacity: 0.7,
                  backgroundColor: 'rgba(244, 67, 54, 0.1)',
                  border: '1px solid rgba(244, 67, 54, 0.3)'
                };
              } else if (requestStatus === 'PENDING') {
                statusStyle = {
                  opacity: 0.8,
                  backgroundColor: 'rgba(255, 193, 7, 0.1)',
                  border: '1px solid rgba(255, 193, 7, 0.3)'
                };
              } else if (requestStatus === 'RECEIVED_PENDING') {
                statusStyle = {
                  opacity: 0.85,
                  backgroundColor: 'rgba(23, 162, 184, 0.1)',
                  border: '1px solid rgba(23, 162, 184, 0.3)'
                };
              } else if (requestStatus === 'COMPLETED') {
                statusStyle = {
                  opacity: 0.8,
                  backgroundColor: 'rgba(40, 167, 69, 0.1)',
                  border: '1px solid rgba(40, 167, 69, 0.3)'
                };
              }
              
              return (
              <div 
                key={match.user.id} 
                className="match-card"
                style={statusStyle}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '10px' }}>
                  <h3>{match.user.full_name || match.user.username}</h3>
                  {requestStatus && requestStatus !== 'RECEIVED_PENDING' && requestStatus !== 'COMPLETED' && (
                    <span className={`badge badge-${requestStatus.toLowerCase()}`} style={{ marginLeft: '10px' }}>
                      {requestStatus === 'ACTIVE' && '✓ Active'}
                      {requestStatus === 'PENDING' && '⏳ Pending'}
                      {requestStatus === 'REJECTED' && '✗ Rejected'}
                    </span>
                  )}
                  {requestStatus === 'RECEIVED_PENDING' && (
                    <span className="badge badge-pending" style={{ marginLeft: '10px', backgroundColor: 'rgba(23, 162, 184, 0.8)' }}>
                      📬 Request Received
                    </span>
                  )}
                </div>
                <div className="rating" style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                    {[1, 2, 3, 4, 5].map((star) => (
                      <span
                        key={star}
                        onClick={async () => {
                          // Check if user has completed swaps with this user - fetch fresh data
                          try {
                            const swapsResponse = await axios.get('/api/swap-sessions');
                            const allSwaps = swapsResponse.data.swap_sessions || [];
                            const completed = allSwaps.filter(swap => swap.status === 'COMPLETED');
                            
                            const hasCompletedSwap = completed.some(swap => 
                              (parseInt(swap.user1_id) === parseInt(match.user.id) && parseInt(swap.user2_id) === parseInt(user.id)) ||
                              (parseInt(swap.user2_id) === parseInt(match.user.id) && parseInt(swap.user1_id) === parseInt(user.id))
                            );
                            
                            if (hasCompletedSwap) {
                              setRatingModal({
                                userId: match.user.id,
                                userName: match.user.full_name || match.user.username,
                                currentRating: match.user.rating
                              });
                              setSelectedRating(0);
                            } else {
                              alert('You can only rate users you have completed swaps with');
                            }
                          } catch (error) {
                            console.error('Error checking completed swaps:', error);
                            alert('Error checking swap history. Please try again.');
                          }
                        }}
                        onMouseEnter={() => {
                          // Check completed swaps from state
                          const hasCompletedSwap = completedSwaps.some(swap => 
                            (parseInt(swap.user1_id) === parseInt(match.user.id) && parseInt(swap.user2_id) === parseInt(user.id)) ||
                            (parseInt(swap.user2_id) === parseInt(match.user.id) && parseInt(swap.user1_id) === parseInt(user.id))
                          );
                          if (hasCompletedSwap) {
                            setHoveredRating(star);
                          }
                        }}
                        onMouseLeave={() => setHoveredRating(0)}
                        style={{
                          cursor: completedSwaps.some(swap => 
                            (parseInt(swap.user1_id) === parseInt(match.user.id) && parseInt(swap.user2_id) === parseInt(user.id)) ||
                            (parseInt(swap.user2_id) === parseInt(match.user.id) && parseInt(swap.user1_id) === parseInt(user.id))
                          ) ? 'pointer' : 'default',
                          fontSize: '20px',
                          color: (hoveredRating >= star || (!hoveredRating && match.user.rating >= star)) 
                            ? '#ffc107' 
                            : '#ddd',
                          transition: 'color 0.2s',
                          userSelect: 'none'
                        }}
                      >
                        ★
                      </span>
                    ))}
                  </div>
                  <span style={{ fontSize: '14px', color: '#666' }}>
                    {match.user.rating.toFixed(1)} / 5.0
                  </span>
                </div>
                {match.user.bio && <p style={{ marginBottom: '15px', color: '#666' }}>{match.user.bio}</p>}
                
                {match.matching_skills.they_offer_that_i_want.length > 0 && (
                  <div className="skills">
                    <strong>They offer (you want):</strong>
                    {match.matching_skills.they_offer_that_i_want.map((skill, idx) => (
                      <span key={idx} className="skill-tag offer">{skill}</span>
                    ))}
                  </div>
                )}
                
                {match.matching_skills.i_offer_that_they_want.length > 0 && (
                  <div className="skills" style={{ marginTop: '10px' }}>
                    <strong>You offer (they want):</strong>
                    {match.matching_skills.i_offer_that_they_want.map((skill, idx) => (
                      <span key={idx} className="skill-tag want">{skill}</span>
                    ))}
                  </div>
                )}
                
                {match.matching_skills.they_offer_that_i_want.length === 0 && match.matching_skills.i_offer_that_they_want.length === 0 && (
                  <p style={{ color: '#6c757d', fontSize: '14px', marginTop: '10px' }}>
                    Potential match - check their profile for available skills
                  </p>
                )}

                {/* Show Active status with Complete button */}
                {requestStatus === 'ACTIVE' && activeSwapId && (
                  <div style={{
                    marginTop: '15px',
                    padding: '12px',
                    borderRadius: '8px',
                    textAlign: 'center',
                    fontWeight: '600',
                    fontSize: '14px',
                    backgroundColor: 'rgba(40, 167, 69, 0.2)',
                    color: '#28a745',
                    border: '1px solid rgba(40, 167, 69, 0.4)',
                    marginBottom: '10px'
                  }}>
                    ✓ Active Swap
                  </div>
                )}

                {/* Show pending status if current user SENT a request (waiting for their response) */}
                {requestStatus === 'PENDING' && !isReceivedRequest && (
                  <div style={{
                    marginTop: '15px',
                    padding: '12px',
                    borderRadius: '8px',
                    textAlign: 'center',
                    fontWeight: '600',
                    fontSize: '14px',
                    backgroundColor: 'rgba(255, 193, 7, 0.2)',
                    color: '#ffc107',
                    border: '1px solid rgba(255, 193, 7, 0.4)',
                    marginBottom: '10px'
                  }}>
                    ⏳ Request Sent - Waiting for Response
                  </div>
                )}
                
                {/* Show message if user RECEIVED a request FROM this matched user */}
                {requestStatus === 'RECEIVED_PENDING' && (
                  <div style={{
                    marginTop: '15px',
                    padding: '12px',
                    borderRadius: '8px',
                    textAlign: 'center',
                    fontWeight: '600',
                    fontSize: '14px',
                    backgroundColor: 'rgba(23, 162, 184, 0.2)',
                    color: '#17a2b8',
                    border: '1px solid rgba(23, 162, 184, 0.4)',
                    marginBottom: '10px'
                  }}>
                    📬 {match.user.full_name || match.user.username} sent you a swap request
                  </div>
                )}
                
                {/* Show rejected status if request was rejected */}
                {requestStatus === 'REJECTED' && (
                  <div style={{
                    marginTop: '15px',
                    padding: '12px',
                    borderRadius: '8px',
                    textAlign: 'center',
                    fontWeight: '600',
                    fontSize: '14px',
                    backgroundColor: 'rgba(244, 67, 54, 0.2)',
                    color: '#f44336',
                    border: '1px solid rgba(244, 67, 54, 0.4)',
                    marginBottom: '10px'
                  }}>
                    ✗ Request Rejected
                  </div>
                )}
                
                {/* Show Complete button if there's an active swap - opens rating modal first */}
                {requestStatus === 'ACTIVE' && activeSwapId && (
                  <button
                    className="btn btn-primary"
                    onClick={() => {
                      console.log('Opening rating modal for swap completion');
                      console.log('Active Swap ID:', activeSwapId);
                      console.log('User ID:', match.user.id);
                      // Open rating modal first, pass swapId so we can complete after rating
                      setRatingModal({
                        userId: match.user.id,
                        userName: match.user.full_name || match.user.username,
                        currentRating: match.user.rating,
                        swapId: activeSwapId
                      });
                      setSelectedRating(0);
                    }}
                    style={{ 
                      marginTop: '15px', 
                      width: '100%',
                      backgroundColor: 'rgba(40, 167, 69, 0.8)',
                      border: '1px solid rgba(40, 167, 69, 0.5)'
                    }}
                  >
                    ✓ Mark as Completed & Rate
                  </button>
                )}

                {/* Show Completed button if there's a completed swap - opens rating modal only if not rated yet */}
                {requestStatus === 'COMPLETED' && (
                  <div style={{ marginTop: '15px' }}>
                    <div style={{
                      padding: '10px',
                      borderRadius: '8px',
                      textAlign: 'center',
                      fontWeight: '600',
                      fontSize: '14px',
                      backgroundColor: 'rgba(40, 167, 69, 0.15)',
                      color: '#28a745',
                      border: '1px solid rgba(40, 167, 69, 0.3)',
                      marginBottom: '10px'
                    }}>
                      ✓ Swap Completed
                    </div>
                    <button
                      className="btn btn-primary"
                      onClick={() => {
                        setRatingModal({
                          userId: match.user.id,
                          userName: match.user.full_name || match.user.username,
                          currentRating: match.user.rating
                        });
                        setSelectedRating(0);
                      }}
                      style={{ 
                        width: '100%',
                        marginBottom: '10px',
                        backgroundColor: 'rgba(255, 193, 7, 0.8)',
                        border: '1px solid rgba(255, 193, 7, 0.5)'
                      }}
                    >
                      ⭐ Rate User
                    </button>
                    <button
                      className="btn btn-primary"
                      onClick={() => handleRequestSwap(match.user.id)}
                      style={{ 
                        width: '100%',
                        backgroundColor: 'rgba(40, 167, 69, 0.8)',
                        border: '1px solid rgba(40, 167, 69, 0.5)'
                      }}
                    >
                      🔄 Request New Swap
                    </button>
                  </div>
                )}
                
                {/* Show Accept/Reject buttons if user RECEIVED a pending request FROM this matched user */}
                {requestStatus === 'RECEIVED_PENDING' && pendingRequestId && (
                  <div style={{ marginTop: '15px', display: 'flex', gap: '10px' }}>
                    <button
                      className="btn btn-primary"
                      onClick={async () => {
                        try {
                          await axios.post(`/api/swap-requests/${pendingRequestId}/accept`);
                          alert('Swap request accepted! An active swap session has been created.');
                          // Refresh all data
                          await loadDashboardData();
                          navigate('/dashboard');
                        } catch (error) {
                          alert(error.response?.data?.error || 'Failed to accept swap request');
                        }
                      }}
                      style={{ flex: 1 }}
                    >
                      Accept
                    </button>
                    <button
                      className="btn btn-danger"
                      onClick={async () => {
                        if (!window.confirm('Are you sure you want to reject this swap request?')) return;
                        try {
                          await axios.post(`/api/swap-requests/${pendingRequestId}/reject`);
                          alert('Swap request rejected');
                          // Refresh all data
                          await loadDashboardData();
                        } catch (error) {
                          alert(error.response?.data?.error || 'Failed to reject swap request');
                        }
                      }}
                      style={{ flex: 1 }}
                    >
                      Reject
                    </button>
                  </div>
                )}

                {/* Show Connect/Request Swap button ONLY if there's NO completed swap, NO active swap AND no pending received request */}
                {requestStatus !== 'COMPLETED' && requestStatus !== 'ACTIVE' && requestStatus !== 'RECEIVED_PENDING' && (
                  <button
                    className="btn btn-primary"
                    onClick={() => handleRequestSwap(match.user.id)}
                    style={{ 
                      marginTop: (requestStatus === 'REJECTED' || requestStatus === 'PENDING') ? '0' : '15px', 
                      width: '100%' 
                    }}
                  >
                    {requestStatus === 'REJECTED' ? 'Connect & Request Swap Again' :
                     requestStatus === 'PENDING' ? 'Request Sent - Waiting for Response' :
                     'Request Swap'}
                  </button>
                )}
              </div>
            );
            })}
          </div>
        )}
      </section>

      {/* Rating Modal */}
      {ratingModal && (
        <div 
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000
          }}
          onClick={() => {
            setRatingModal(null);
            setSelectedRating(0);
            setHoveredRating(0);
          }}
        >
          <div 
            className="card"
            style={{
              backgroundColor: 'white',
              padding: '30px',
              borderRadius: '12px',
              maxWidth: '400px',
              width: '90%',
              boxShadow: '0 10px 30px rgba(0, 0, 0, 0.3)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 style={{ marginBottom: '20px', textAlign: 'center' }}>
              {ratingModal.swapId ? 'Complete Swap & Rate' : 'Rate'} {ratingModal.userName}
            </h2>
            {ratingModal.swapId && (
              <p style={{ textAlign: 'center', color: '#666', marginBottom: '15px', fontSize: '14px' }}>
                Please rate this user to complete the swap
              </p>
            )}
            
            <div style={{ display: 'flex', justifyContent: 'center', gap: '10px', marginBottom: '20px' }}>
              {[1, 2, 3, 4, 5].map((star) => (
                <span
                  key={star}
                  onClick={() => setSelectedRating(star)}
                  onMouseEnter={() => setHoveredRating(star)}
                  onMouseLeave={() => setHoveredRating(0)}
                  style={{
                    cursor: 'pointer',
                    fontSize: '40px',
                    color: (hoveredRating >= star || (!hoveredRating && selectedRating >= star)) 
                      ? '#ffc107' 
                      : '#ddd',
                    transition: 'color 0.2s, transform 0.2s',
                    userSelect: 'none',
                    transform: (hoveredRating >= star || selectedRating >= star) ? 'scale(1.1)' : 'scale(1)'
                  }}
                >
                  ★
                </span>
              ))}
            </div>

            {selectedRating > 0 && (
              <p style={{ textAlign: 'center', color: '#666', marginBottom: '20px' }}>
                Selected: {selectedRating} {selectedRating === 1 ? 'star' : 'stars'}
              </p>
            )}

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
              <button
                className="btn btn-primary"
                onClick={async () => {
                  if (selectedRating === 0) {
                    alert('Please select a rating');
                    return;
                  }
                  
                  try {
                    // If there's a swapId, mark the swap as completed FIRST, then submit rating
                    if (ratingModal.swapId) {
                      console.log('Starting completion flow for swap:', ratingModal.swapId);
                      
                      // First, complete the swap
                      try {
                        const completeResponse = await axios.post(`/api/swap-sessions/${ratingModal.swapId}/complete`);
                        console.log('Swap completion response:', completeResponse.data);
                      } catch (completeError) {
                        console.error('Error completing swap:', completeError);
                        console.error('Swap ID:', ratingModal.swapId);
                        console.error('Error response:', completeError.response?.data);
                        alert('Failed to complete swap: ' + (completeError.response?.data?.error || completeError.message || 'Unknown error'));
                        return; // Don't close modal on error
                      }
                      
                      // Wait a bit to ensure database is updated
                      await new Promise(resolve => setTimeout(resolve, 1000));
                      
                      // Then submit the rating (now swap is completed)
                      try {
                        const userId = parseInt(ratingModal.userId);
                        if (!userId || isNaN(userId)) {
                          throw new Error('Invalid user ID: ' + ratingModal.userId);
                        }
                        
                        console.log('Submitting rating for user ID:', userId);
                        const ratingUrl = `/api/reviews/rate/${userId}`;
                        console.log('Rating URL:', ratingUrl);
                        console.log('Full request:', { url: ratingUrl, method: 'POST', data: { rating: parseInt(selectedRating) } });
                        
                        const ratingResponse = await axios.post(ratingUrl, {
                          rating: parseInt(selectedRating)
                        });
                        console.log('Rating response:', ratingResponse.data);
                        alert('Swap completed and rating submitted successfully!');
                      } catch (ratingError) {
                        console.error('Error submitting rating:', ratingError);
                        console.error('User ID (raw):', ratingModal.userId);
                        console.error('User ID (parsed):', parseInt(ratingModal.userId));
                        console.error('Rating:', selectedRating);
                        console.error('Full error:', ratingError);
                        console.error('Error response:', ratingError.response?.data);
                        console.error('Error status:', ratingError.response?.status);
                        console.error('Request URL:', ratingError.config?.url);
                        
                        const errorMsg = ratingError.response?.data?.error || ratingError.message || 'Unknown error';
                        alert('Swap completed but failed to submit rating: ' + errorMsg + ' (Status: ' + (ratingError.response?.status || 'N/A') + ')');
                        // Swap is completed, so we can close modal but show warning
                        setRatingModal(null);
                        setSelectedRating(0);
                        setHoveredRating(0);
                        await loadDashboardData();
                        return;
                      }
                    } else {
                      // No swapId - just submit rating (for already completed swaps)
                      const response = await axios.post(`/api/reviews/rate/${ratingModal.userId}`, {
                        rating: selectedRating
                      });
                      console.log('Rating response:', response.data);
                      alert('Rating submitted successfully!');
                    }
                    
                    setRatingModal(null);
                    setSelectedRating(0);
                    setHoveredRating(0);
                    
                    // Refresh dashboard to update ratings and swap status
                    await loadDashboardData();
                    
                    // Trigger events
                    if (ratingModal.swapId) {
                      window.dispatchEvent(new CustomEvent('swapCompleted'));
                      window.dispatchEvent(new Event('swapCompleted'));
                    }
                  } catch (error) {
                    console.error('Unexpected error in rating flow:', error);
                    console.error('Error details:', error.response?.data);
                    alert('Unexpected error: ' + (error.response?.data?.error || error.message || 'Please try again'));
                  }
                }}
                disabled={selectedRating === 0}
              >
                {ratingModal.swapId ? 'Complete Swap & Submit Rating' : 'Submit Rating'}
              </button>
              <button
                className="btn btn-secondary"
                onClick={() => {
                  setRatingModal(null);
                  setSelectedRating(0);
                  setHoveredRating(0);
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;

