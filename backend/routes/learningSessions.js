/**
 * Learning Sessions Routes
 * Handles scheduling and management of learning sessions within active swaps
 */

const express = require('express');
const { getDatabase } = require('../database/db');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

/**
 * Create a learning session
 * POST /api/learning-sessions
 */
router.post('/', authenticateToken, (req, res) => {
  const { swap_session_id, teacher_id, student_id, topic, session_type, scheduled_date, duration_hours, notes, meeting_link, place } = req.body;

  if (!swap_session_id || !teacher_id || !student_id || !topic || !session_type || !scheduled_date) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  if (!['Online', 'Offline'].includes(session_type)) {
    return res.status(400).json({ error: 'Session type must be Online or Offline' });
  }

  // Validate required fields based on session type
  if (session_type === 'Online' && !meeting_link) {
    return res.status(400).json({ error: 'Meeting link is required for online sessions' });
  }
  if (session_type === 'Offline' && !place) {
    return res.status(400).json({ error: 'Meeting place is required for offline sessions' });
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
      return res.status(403).json({ error: 'Not authorized to create session for this swap' });
    }
    if (swapSession.status !== 'ACTIVE') {
      return res.status(400).json({ error: 'Swap session is not active' });
    }

    // Verify teacher and student are part of the swap
    if ((teacher_id !== swapSession.user1_id && teacher_id !== swapSession.user2_id) ||
        (student_id !== swapSession.user1_id && student_id !== swapSession.user2_id)) {
      return res.status(400).json({ error: 'Teacher and student must be part of the swap session' });
    }

    // Create learning session
    db.run(
      `INSERT INTO sessions (swap_session_id, teacher_id, student_id, topic, session_type, scheduled_date, duration_hours, notes, meeting_link, place)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [swap_session_id, teacher_id, student_id, topic, session_type, scheduled_date, duration_hours || 1.0, notes || null, meeting_link || null, place || null],
      function(err) {
        if (err) {
          return res.status(500).json({ error: 'Error creating learning session' });
        }

        db.get('SELECT * FROM sessions WHERE id = ?', [this.lastID], (err, session) => {
          if (err) {
            return res.status(500).json({ error: 'Error fetching created session' });
          }
          res.status(201).json({ message: 'Learning session created successfully', session });
        });
      }
    );
  });
});

/**
 * Get all learning sessions for a swap session
 * GET /api/learning-sessions/swap/:swapSessionId
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
      `SELECT s.*, 
              t.username as teacher_username, t.full_name as teacher_name,
              st.username as student_username, st.full_name as student_name
       FROM sessions s
       JOIN users t ON s.teacher_id = t.id
       JOIN users st ON s.student_id = st.id
       WHERE s.swap_session_id = ?
       ORDER BY s.scheduled_date ASC`,
      [swapSessionId],
      (err, sessions) => {
        if (err) {
          return res.status(500).json({ error: 'Database error' });
        }
        res.json({ sessions });
      }
    );
  });
});

/**
 * Update learning session status
 * PUT /api/learning-sessions/:id
 */
router.put('/:id', authenticateToken, (req, res) => {
  const { status, notes } = req.body;
  const sessionId = req.params.id;

  if (status && !['SCHEDULED', 'COMPLETED', 'CANCELLED'].includes(status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }

  const db = getDatabase();

  // Get session and verify access
  db.get(
    `SELECT s.*, ss.user1_id, ss.user2_id
     FROM sessions s
     JOIN swap_sessions ss ON s.swap_session_id = ss.id
     WHERE s.id = ?`,
    [sessionId],
    (err, session) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }
      if (!session) {
        return res.status(404).json({ error: 'Session not found' });
      }
      if (session.user1_id !== req.user.id && session.user2_id !== req.user.id) {
        return res.status(403).json({ error: 'Not authorized' });
      }

      // Update session
      const updates = [];
      const params = [];
      if (status) {
        updates.push('status = ?');
        params.push(status);
      }
      if (notes !== undefined) {
        updates.push('notes = ?');
        params.push(notes);
      }

      if (updates.length === 0) {
        return res.status(400).json({ error: 'No fields to update' });
      }

      params.push(sessionId);

      db.run(
        `UPDATE sessions SET ${updates.join(', ')} WHERE id = ?`,
        params,
        function(err) {
          if (err) {
            return res.status(500).json({ error: 'Error updating session' });
          }

          db.get('SELECT * FROM sessions WHERE id = ?', [sessionId], (err, updatedSession) => {
            if (err) {
              return res.status(500).json({ error: 'Error fetching updated session' });
            }
            res.json({ message: 'Session updated successfully', session: updatedSession });
          });
        }
      );
    }
  );
});

module.exports = router;

