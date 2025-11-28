/**
 * Admin Routes
 * Handles admin operations (view users, swaps, resolve disputes)
 */

const express = require('express');
const { getDatabase } = require('../database/db');
const { authenticateToken, isAdmin } = require('../middleware/auth');

const router = express.Router();

// All admin routes require authentication and admin privileges
router.use(authenticateToken);
router.use(isAdmin);

/**
 * Get all users with statistics
 * GET /api/admin/users
 */
router.get('/users', (req, res) => {
  const db = getDatabase();

  db.all(
    `SELECT id, username, email, full_name, rating, total_swaps, is_admin, created_at
     FROM users
     ORDER BY created_at DESC`,
    [],
    (err, users) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }
      res.json({ users });
    }
  );
});

/**
 * Get all swap requests
 * GET /api/admin/swap-requests
 */
router.get('/swap-requests', (req, res) => {
  const db = getDatabase();

  db.all(
    `SELECT sr.*, 
            u1.username as requester_username, u1.email as requester_email,
            u2.username as receiver_username, u2.email as receiver_email,
            s1.skill_name as requester_skill_name,
            s2.skill_name as receiver_skill_name
     FROM swap_requests sr
     JOIN users u1 ON sr.requester_id = u1.id
     JOIN users u2 ON sr.receiver_id = u2.id
     JOIN skills s1 ON sr.requester_skill_id = s1.id
     JOIN skills s2 ON sr.receiver_skill_id = s2.id
     ORDER BY sr.created_at DESC`,
    [],
    (err, swapRequests) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }
      res.json({ swap_requests: swapRequests });
    }
  );
});

/**
 * Get all swap sessions
 * GET /api/admin/swap-sessions
 */
router.get('/swap-sessions', (req, res) => {
  const db = getDatabase();

  db.all(
    `SELECT ss.*,
            u1.username as user1_username, u1.email as user1_email,
            u2.username as user2_username, u2.email as user2_email,
            s1.skill_name as user1_skill_name,
            s2.skill_name as user2_skill_name
     FROM swap_sessions ss
     JOIN users u1 ON ss.user1_id = u1.id
     JOIN users u2 ON ss.user2_id = u2.id
     JOIN skills s1 ON ss.user1_skill_id = s1.id
     JOIN skills s2 ON ss.user2_skill_id = s2.id
     ORDER BY ss.started_at DESC`,
    [],
    (err, swapSessions) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }
      res.json({ swap_sessions: swapSessions });
    }
  );
});

/**
 * Cancel a swap session (dispute resolution)
 * POST /api/admin/swap-sessions/:id/cancel
 */
router.post('/swap-sessions/:id/cancel', (req, res) => {
  const db = getDatabase();
  const sessionId = req.params.id;

  db.get('SELECT * FROM swap_sessions WHERE id = ?', [sessionId], (err, swapSession) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    if (!swapSession) {
      return res.status(404).json({ error: 'Swap session not found' });
    }

    db.run(
      'UPDATE swap_sessions SET status = "CANCELLED" WHERE id = ?',
      [sessionId],
      function(err) {
        if (err) {
          return res.status(500).json({ error: 'Error cancelling swap session' });
        }
        res.json({ message: 'Swap session cancelled by admin' });
      }
    );
  });
});

/**
 * Get platform statistics
 * GET /api/admin/stats
 */
router.get('/stats', (req, res) => {
  const db = getDatabase();

  const stats = {};

  // Total users
  db.get('SELECT COUNT(*) as count FROM users', [], (err, result) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    stats.total_users = result.count;

    // Total swaps
    db.get('SELECT COUNT(*) as count FROM swap_sessions', [], (err, result) => {
      if (err) return res.status(500).json({ error: 'Database error' });
      stats.total_swaps = result.count;

      // Active swaps
      db.get('SELECT COUNT(*) as count FROM swap_sessions WHERE status = "ACTIVE"', [], (err, result) => {
        if (err) return res.status(500).json({ error: 'Database error' });
        stats.active_swaps = result.count;

        // Completed swaps
        db.get('SELECT COUNT(*) as count FROM swap_sessions WHERE status = "COMPLETED"', [], (err, result) => {
          if (err) return res.status(500).json({ error: 'Database error' });
          stats.completed_swaps = result.count;

          // Total skills
          db.get('SELECT COUNT(*) as count FROM skills', [], (err, result) => {
            if (err) return res.status(500).json({ error: 'Database error' });
            stats.total_skills = result.count;

            res.json({ statistics: stats });
          });
        });
      });
    });
  });
});

module.exports = router;

