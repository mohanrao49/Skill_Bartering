/**
 * Messages Routes
 * Handles chat messages within active swap sessions
 */

const express = require('express');
const { getDatabase } = require('../database/db');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

/**
 * Send a message in a swap session
 * POST /api/messages
 */
router.post('/', authenticateToken, (req, res) => {
  const { swap_session_id, message_text, message, receiver_id } = req.body;
  const messageContent = message_text || message;

  if (!swap_session_id || !messageContent) {
    return res.status(400).json({ error: 'Swap session ID and message text are required' });
  }

  const db = getDatabase();

  // Verify swap session exists and user is part of it
  db.get('SELECT * FROM swap_sessions WHERE id = ?', [swap_session_id], (err, swapSession) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    if (!swapSession) {
      return res.status(404).json({ error: 'Swap session not found' });
    }
    if (swapSession.user1_id !== req.user.id && swapSession.user2_id !== req.user.id) {
      return res.status(403).json({ error: 'Not authorized to send messages in this swap session' });
    }
    // Allow messages for both ACTIVE and COMPLETED swap sessions
    if (swapSession.status !== 'ACTIVE' && swapSession.status !== 'COMPLETED') {
      return res.status(400).json({ error: 'Can only send messages in active or completed swap sessions' });
    }

    // Create message
    db.run(
      'INSERT INTO messages (swap_session_id, sender_id, message_text) VALUES (?, ?, ?)',
      [swap_session_id, req.user.id, messageContent],
      function(err) {
        if (err) {
          return res.status(500).json({ error: 'Error sending message' });
        }

        db.get(
          `SELECT m.*, u.username as sender_username, u.full_name as sender_name
           FROM messages m
           JOIN users u ON m.sender_id = u.id
           WHERE m.id = ?`,
          [this.lastID],
          (err, message) => {
            if (err) {
              return res.status(500).json({ error: 'Error fetching created message' });
            }
            res.status(201).json({ message });
          }
        );
      }
    );
  });
});

/**
 * Get all messages for a swap session
 * GET /api/messages/swap/:swapSessionId
 */
router.get('/swap/:swapSessionId', authenticateToken, (req, res) => {
  const db = getDatabase();
  const swapSessionId = req.params.swapSessionId;

  // Verify user has access to this swap session
  db.get('SELECT * FROM swap_sessions WHERE id = ?', [swapSessionId], (err, swapSession) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    if (!swapSession) {
      return res.status(404).json({ error: 'Swap session not found' });
    }
    if (swapSession.user1_id !== req.user.id && swapSession.user2_id !== req.user.id) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    db.all(
      `SELECT m.*, u.username as sender_username, u.full_name as sender_name
       FROM messages m
       JOIN users u ON m.sender_id = u.id
       WHERE m.swap_session_id = ?
       ORDER BY m.created_at ASC`,
      [swapSessionId],
      (err, messages) => {
        if (err) {
          return res.status(500).json({ error: 'Database error' });
        }
        res.json({ messages });
      }
    );
  });
});

module.exports = router;

