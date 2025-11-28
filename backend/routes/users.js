/**
 * User Routes
 * Handles user profile operations
 */

const express = require('express');
const { getDatabase } = require('../database/db');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

/**
 * Get user profile by ID
 * GET /api/users/:id
 */
router.get('/:id', authenticateToken, (req, res) => {
  const db = getDatabase();
  const userId = req.params.id;

  db.get(
    'SELECT id, username, email, full_name, bio, rating, total_swaps, created_at FROM users WHERE id = ?',
    [userId],
    (err, user) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }
      res.json(user);
    }
  );
});

/**
 * Update user profile
 * PUT /api/users/:id
 */
router.put('/:id', authenticateToken, (req, res) => {
  // Users can only update their own profile unless admin
  if (parseInt(req.params.id) !== req.user.id && !req.user.is_admin) {
    return res.status(403).json({ error: 'You can only update your own profile' });
  }

  const { full_name, bio } = req.body;
  const db = getDatabase();

  db.run(
    'UPDATE users SET full_name = ?, bio = ? WHERE id = ?',
    [full_name || null, bio || null, req.params.id],
    function(err) {
      if (err) {
        return res.status(500).json({ error: 'Error updating profile' });
      }
      if (this.changes === 0) {
        return res.status(404).json({ error: 'User not found' });
      }
      res.json({ message: 'Profile updated successfully' });
    }
  );
});

/**
 * Get all users (admin only)
 * GET /api/users
 */
router.get('/', authenticateToken, (req, res) => {
  // Only admin can view all users
  if (!req.user.is_admin) {
    return res.status(403).json({ error: 'Admin access required' });
  }

  const db = getDatabase();
  db.all(
    'SELECT id, username, email, full_name, bio, rating, total_swaps, is_admin, created_at FROM users',
    [],
    (err, users) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }
      res.json(users);
    }
  );
});

module.exports = router;

