/**
 * Swap Session Routes
 * Handles active swap sessions (sessions, resources, chat, completion)
 */

const express = require('express');
const { getDatabase } = require('../database/db');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

/**
 * Get all swap sessions for current user (active and completed)
 * GET /api/swap-sessions
 * Returns only unique swaps (deduplicates by user pair)
 */
router.get('/', authenticateToken, (req, res) => {
  const db = getDatabase();
  const userId = req.user.id;

  const query = `
    SELECT ss.*,
           u1.username as user1_username, u1.full_name as user1_name,
           u2.username as user2_username, u2.full_name as user2_name,
           s1.skill_name as user1_skill_name,
           s2.skill_name as user2_skill_name
    FROM swap_sessions ss
    JOIN users u1 ON ss.user1_id = u1.id
    JOIN users u2 ON ss.user2_id = u2.id
    JOIN skills s1 ON ss.user1_skill_id = s1.id
    JOIN skills s2 ON ss.user2_skill_id = s2.id
    WHERE (ss.user1_id = ? OR ss.user2_id = ?)
    ORDER BY ss.started_at DESC
  `;

  db.all(query, [userId, userId], (err, sessions) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    
    // Deduplicate: Keep the most recent swap per user pair (regardless of user order)
    // Use Map to track the most recent swap for each pair
    const uniqueSwapsMap = new Map();
    
    sessions.forEach(session => {
      // Create a unique key for the user pair (sorted to handle both orders)
      const pairKey = [session.user1_id, session.user2_id].sort().join('-');
      const existing = uniqueSwapsMap.get(pairKey);
      
      // Keep the most recent swap based on started_at or completed_at
      if (!existing) {
        uniqueSwapsMap.set(pairKey, session);
      } else {
        const existingDate = new Date(existing.started_at || existing.completed_at || 0);
        const currentDate = new Date(session.started_at || session.completed_at || 0);
        if (currentDate > existingDate) {
          uniqueSwapsMap.set(pairKey, session);
        }
      }
    });
    
    const uniqueSwaps = Array.from(uniqueSwapsMap.values());
    res.json({ swap_sessions: uniqueSwaps });
  });
});

/**
 * Get a specific swap session with all details
 * GET /api/swap-sessions/:id
 */
router.get('/:id', authenticateToken, (req, res) => {
  const db = getDatabase();
  const sessionId = req.params.id;
  const userId = req.user.id;

  // Get swap session
  db.get(
    `SELECT ss.*,
           u1.id as user1_id, u1.username as user1_username, u1.full_name as user1_name,
           u2.id as user2_id, u2.username as user2_username, u2.full_name as user2_name,
           s1.id as user1_skill_id, s1.skill_name as user1_skill_name,
           s2.id as user2_skill_id, s2.skill_name as user2_skill_name
    FROM swap_sessions ss
    JOIN users u1 ON ss.user1_id = u1.id
    JOIN users u2 ON ss.user2_id = u2.id
    JOIN skills s1 ON ss.user1_skill_id = s1.id
    JOIN skills s2 ON ss.user2_skill_id = s2.id
    WHERE ss.id = ?`,
    [sessionId],
    (err, swapSession) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }
      if (!swapSession) {
        return res.status(404).json({ error: 'Swap session not found' });
      }
      if (swapSession.user1_id !== userId && swapSession.user2_id !== userId) {
        return res.status(403).json({ error: 'Not authorized to view this swap session' });
      }

      // Get all learning sessions
      db.all(
        'SELECT * FROM sessions WHERE swap_session_id = ? ORDER BY scheduled_date ASC',
        [sessionId],
        (err, learningSessions) => {
          if (err) {
            return res.status(500).json({ error: 'Database error' });
          }

          // Get all resources
          db.all(
            `SELECT r.*, u.username as uploaded_by_username
             FROM resources r
             JOIN users u ON r.uploaded_by = u.id
             WHERE r.swap_session_id = ?
             ORDER BY r.created_at DESC`,
            [sessionId],
            (err, resources) => {
              if (err) {
                return res.status(500).json({ error: 'Database error' });
              }

              // Get all messages
              db.all(
                `SELECT m.*, u.username as sender_username
                 FROM messages m
                 JOIN users u ON m.sender_id = u.id
                 WHERE m.swap_session_id = ?
                 ORDER BY m.created_at ASC`,
                [sessionId],
                (err, messages) => {
                  if (err) {
                    return res.status(500).json({ error: 'Database error' });
                  }

                  res.json({
                    swap_session: swapSession,
                    learning_sessions: learningSessions,
                    resources: resources,
                    messages: messages
                  });
                }
              );
            }
          );
        }
      );
    }
  );
});

/**
 * Mark swap session as completed
 * POST /api/swap-sessions/:id/complete
 */
router.post('/:id/complete', authenticateToken, (req, res) => {
  const db = getDatabase();
  const sessionId = req.params.id;
  const userId = req.user.id;

  // Get swap session
  db.get('SELECT * FROM swap_sessions WHERE id = ?', [sessionId], (err, swapSession) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    if (!swapSession) {
      return res.status(404).json({ error: 'Swap session not found' });
    }
    if (swapSession.user1_id !== userId && swapSession.user2_id !== userId) {
      return res.status(403).json({ error: 'Not authorized to complete this swap session' });
    }
    if (swapSession.status !== 'ACTIVE') {
      return res.status(400).json({ error: 'Swap session is not active' });
    }

    // Update swap session status
    db.run(
      'UPDATE swap_sessions SET status = "COMPLETED", completed_at = CURRENT_TIMESTAMP WHERE id = ?',
      [sessionId],
      function(err) {
        if (err) {
          return res.status(500).json({ error: 'Error completing swap session' });
        }

        // Update user swap counts
        db.run(
          'UPDATE users SET total_swaps = total_swaps + 1 WHERE id IN (?, ?)',
          [swapSession.user1_id, swapSession.user2_id],
          (err) => {
            if (err) {
              console.error('Error updating swap counts:', err);
            }
          }
        );

        res.json({ message: 'Swap session marked as completed' });
      }
    );
  });
});

module.exports = router;

