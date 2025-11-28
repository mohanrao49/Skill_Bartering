/**
 * Resources Routes
 * Handles resource sharing within active swap sessions
 */

const express = require('express');
const { getDatabase } = require('../database/db');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

/**
 * Add a resource to a swap session
 * POST /api/resources
 */
router.post('/', authenticateToken, (req, res) => {
  const { swap_session_id, resource_type, title, content, file_path } = req.body;

  if (!swap_session_id || !resource_type || !title) {
    return res.status(400).json({ error: 'Swap session ID, resource type, and title are required' });
  }

  if (!['Link', 'PDF', 'Note', 'Other'].includes(resource_type)) {
    return res.status(400).json({ error: 'Invalid resource type' });
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
      return res.status(403).json({ error: 'Not authorized to add resources to this swap session' });
    }
    if (swapSession.status !== 'ACTIVE') {
      return res.status(400).json({ error: 'Swap session is not active' });
    }

    // Create resource
    db.run(
      `INSERT INTO resources (swap_session_id, uploaded_by, resource_type, title, content, file_path)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [swap_session_id, req.user.id, resource_type, title, content || null, file_path || null],
      function(err) {
        if (err) {
          return res.status(500).json({ error: 'Error adding resource' });
        }

        db.get(
          `SELECT r.*, u.username as uploaded_by_username
           FROM resources r
           JOIN users u ON r.uploaded_by = u.id
           WHERE r.id = ?`,
          [this.lastID],
          (err, resource) => {
            if (err) {
              return res.status(500).json({ error: 'Error fetching created resource' });
            }
            res.status(201).json({ message: 'Resource added successfully', resource });
          }
        );
      }
    );
  });
});

/**
 * Get all resources for a swap session
 * GET /api/resources/swap/:swapSessionId
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
      `SELECT r.*, u.username as uploaded_by_username, u.full_name as uploaded_by_name
       FROM resources r
       JOIN users u ON r.uploaded_by = u.id
       WHERE r.swap_session_id = ?
       ORDER BY r.created_at DESC`,
      [swapSessionId],
      (err, resources) => {
        if (err) {
          return res.status(500).json({ error: 'Database error' });
        }
        res.json({ resources });
      }
    );
  });
});

/**
 * Delete a resource
 * DELETE /api/resources/:id
 */
router.delete('/:id', authenticateToken, (req, res) => {
  const db = getDatabase();
  const resourceId = req.params.id;

  // Get resource and verify ownership or swap session access
  db.get(
    `SELECT r.*, ss.user1_id, ss.user2_id
     FROM resources r
     JOIN swap_sessions ss ON r.swap_session_id = ss.id
     WHERE r.id = ?`,
    [resourceId],
    (err, resource) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }
      if (!resource) {
        return res.status(404).json({ error: 'Resource not found' });
      }
      // User can delete their own resource or if they're part of the swap
      if (resource.uploaded_by !== req.user.id && 
          resource.user1_id !== req.user.id && 
          resource.user2_id !== req.user.id) {
        return res.status(403).json({ error: 'Not authorized to delete this resource' });
      }

      db.run('DELETE FROM resources WHERE id = ?', [resourceId], function(err) {
        if (err) {
          return res.status(500).json({ error: 'Error deleting resource' });
        }
        res.json({ message: 'Resource deleted successfully' });
      });
    }
  );
});

module.exports = router;

