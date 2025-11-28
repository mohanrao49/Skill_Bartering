/**
 * Swap Request Routes
 * Handles swap request creation, acceptance, rejection
 */

const express = require('express');
const { getDatabase } = require('../database/db');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

/**
 * Create a swap request
 * POST /api/swap-requests
 */
router.post('/', authenticateToken, (req, res) => {
  const { receiver_id, requester_skill_id, receiver_skill_id, message } = req.body;
  const requester_id = req.user.id;

  if (!receiver_id || !requester_skill_id || !receiver_skill_id) {
    return res.status(400).json({ error: 'Receiver ID and both skill IDs are required' });
  }

  if (requester_id === parseInt(receiver_id)) {
    return res.status(400).json({ error: 'Cannot create swap request with yourself' });
  }

  const db = getDatabase();

  // Verify skills belong to respective users
  db.get('SELECT * FROM skills WHERE id = ? AND user_id = ?', [requester_skill_id, requester_id], (err, requesterSkill) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    if (!requesterSkill || requesterSkill.skill_type !== 'OFFER') {
      return res.status(400).json({ error: 'Invalid requester skill' });
    }

    db.get('SELECT * FROM skills WHERE id = ? AND user_id = ?', [receiver_skill_id, receiver_id], (err, receiverSkill) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }
      if (!receiverSkill || receiverSkill.skill_type !== 'OFFER') {
        return res.status(400).json({ error: 'Invalid receiver skill' });
      }

      // Check if a swap request already exists
      db.get(
        'SELECT * FROM swap_requests WHERE requester_id = ? AND receiver_id = ? AND status = "PENDING"',
        [requester_id, receiver_id],
        (err, existing) => {
          if (err) {
            return res.status(500).json({ error: 'Database error' });
          }
          if (existing) {
            return res.status(400).json({ error: 'A pending swap request already exists with this user' });
          }

          // Create swap request
          db.run(
            'INSERT INTO swap_requests (requester_id, receiver_id, requester_skill_id, receiver_skill_id, message) VALUES (?, ?, ?, ?, ?)',
            [requester_id, receiver_id, requester_skill_id, receiver_skill_id, message || null],
            function(err) {
              if (err) {
                return res.status(500).json({ error: 'Error creating swap request' });
              }

              // Get full swap request details
              db.get(
                `SELECT sr.*, 
                 u1.username as requester_username, u1.full_name as requester_name,
                 u2.username as receiver_username, u2.full_name as receiver_name,
                 s1.skill_name as requester_skill_name,
                 s2.skill_name as receiver_skill_name
                 FROM swap_requests sr
                 JOIN users u1 ON sr.requester_id = u1.id
                 JOIN users u2 ON sr.receiver_id = u2.id
                 JOIN skills s1 ON sr.requester_skill_id = s1.id
                 JOIN skills s2 ON sr.receiver_skill_id = s2.id
                 WHERE sr.id = ?`,
                [this.lastID],
                (err, swapRequest) => {
                  if (err) {
                    return res.status(500).json({ error: 'Error fetching swap request' });
                  }
                  res.status(201).json({ message: 'Swap request created successfully', swap_request: swapRequest });
                }
              );
            }
          );
        }
      );
    });
  });
});

/**
 * Get swap requests for current user
 * GET /api/swap-requests
 */
router.get('/', authenticateToken, (req, res) => {
  const db = getDatabase();
  const userId = req.user.id;
  const type = req.query.type; // 'sent' or 'received'

  let query;
  if (type === 'sent') {
    query = `
      SELECT sr.*, 
             u2.username as receiver_username, u2.full_name as receiver_name, u2.rating as receiver_rating,
             s1.skill_name as requester_skill_name, s1.description as requester_skill_desc,
             s2.skill_name as receiver_skill_name, s2.description as receiver_skill_desc
      FROM swap_requests sr
      JOIN users u2 ON sr.receiver_id = u2.id
      JOIN skills s1 ON sr.requester_skill_id = s1.id
      JOIN skills s2 ON sr.receiver_skill_id = s2.id
      WHERE sr.requester_id = ?
      ORDER BY sr.created_at DESC
    `;
  } else if (type === 'received') {
    query = `
      SELECT sr.*, 
             u1.username as requester_username, u1.full_name as requester_name, u1.rating as requester_rating,
             s1.skill_name as requester_skill_name, s1.description as requester_skill_desc,
             s2.skill_name as receiver_skill_name, s2.description as receiver_skill_desc
      FROM swap_requests sr
      JOIN users u1 ON sr.requester_id = u1.id
      JOIN skills s1 ON sr.requester_skill_id = s1.id
      JOIN skills s2 ON sr.receiver_skill_id = s2.id
      WHERE sr.receiver_id = ?
      ORDER BY sr.created_at DESC
    `;
  } else {
    // Get all swap requests involving current user
    query = `
      SELECT sr.*, 
             u1.username as requester_username, u1.full_name as requester_name,
             u2.username as receiver_username, u2.full_name as receiver_name,
             s1.skill_name as requester_skill_name,
             s2.skill_name as receiver_skill_name
      FROM swap_requests sr
      JOIN users u1 ON sr.requester_id = u1.id
      JOIN users u2 ON sr.receiver_id = u2.id
      JOIN skills s1 ON sr.requester_skill_id = s1.id
      JOIN skills s2 ON sr.receiver_skill_id = s2.id
      WHERE sr.requester_id = ? OR sr.receiver_id = ?
      ORDER BY sr.created_at DESC
    `;
  }

  const params = type ? [userId] : [userId, userId];

  db.all(query, params, (err, swapRequests) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    res.json({ swap_requests: swapRequests });
  });
});

/**
 * Accept a swap request
 * POST /api/swap-requests/:id/accept
 */
router.post('/:id/accept', authenticateToken, (req, res) => {
  const db = getDatabase();
  const swapRequestId = req.params.id;
  const userId = req.user.id;

  // Get swap request
  db.get('SELECT * FROM swap_requests WHERE id = ?', [swapRequestId], (err, swapRequest) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    if (!swapRequest) {
      return res.status(404).json({ error: 'Swap request not found' });
    }
    if (swapRequest.receiver_id !== userId) {
      return res.status(403).json({ error: 'Only the receiver can accept this request' });
    }
    if (swapRequest.status !== 'PENDING') {
      return res.status(400).json({ error: 'Swap request is not pending' });
    }

    // Update swap request status
    db.run(
      'UPDATE swap_requests SET status = "ACCEPTED", updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [swapRequestId],
      function(err) {
        if (err) {
          return res.status(500).json({ error: 'Error accepting swap request' });
        }

        // Create active swap session
        db.run(
          `INSERT INTO swap_sessions (swap_request_id, user1_id, user2_id, user1_skill_id, user2_skill_id)
           VALUES (?, ?, ?, ?, ?)`,
          [
            swapRequestId,
            swapRequest.requester_id,
            swapRequest.receiver_id,
            swapRequest.requester_skill_id,
            swapRequest.receiver_skill_id
          ],
          function(err) {
            if (err) {
              return res.status(500).json({ error: 'Error creating swap session' });
            }

            res.json({ 
              message: 'Swap request accepted and active swap session created',
              swap_session_id: this.lastID 
            });
          }
        );
      }
    );
  });
});

/**
 * Reject a swap request
 * POST /api/swap-requests/:id/reject
 */
router.post('/:id/reject', authenticateToken, (req, res) => {
  const db = getDatabase();
  const swapRequestId = req.params.id;
  const userId = req.user.id;

  // Get swap request
  db.get('SELECT * FROM swap_requests WHERE id = ?', [swapRequestId], (err, swapRequest) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    if (!swapRequest) {
      return res.status(404).json({ error: 'Swap request not found' });
    }
    if (swapRequest.receiver_id !== userId) {
      return res.status(403).json({ error: 'Only the receiver can reject this request' });
    }
    if (swapRequest.status !== 'PENDING') {
      return res.status(400).json({ error: 'Swap request is not pending' });
    }

    // Update swap request status
    db.run(
      'UPDATE swap_requests SET status = "REJECTED", updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [swapRequestId],
      function(err) {
        if (err) {
          return res.status(500).json({ error: 'Error rejecting swap request' });
        }
        res.json({ message: 'Swap request rejected' });
      }
    );
  });
});

module.exports = router;

