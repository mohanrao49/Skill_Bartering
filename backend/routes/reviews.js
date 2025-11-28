/**
 * Reviews Routes
 * Handles reviews and ratings after swap completion
 */

const express = require('express');
const { getDatabase } = require('../database/db');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

/**
 * Create a review for a completed swap
 * POST /api/reviews
 */
router.post('/', authenticateToken, (req, res) => {
  const { swap_session_id, reviewee_id, rating, comment } = req.body;

  if (!swap_session_id || !reviewee_id || !rating) {
    return res.status(400).json({ error: 'Swap session ID, reviewee ID, and rating are required' });
  }

  if (rating < 1 || rating > 5) {
    return res.status(400).json({ error: 'Rating must be between 1 and 5' });
  }

  const db = getDatabase();

  // Verify swap session exists, is completed, and user is part of it
  db.get('SELECT * FROM swap_sessions WHERE id = ?', [swap_session_id], (err, swapSession) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    if (!swapSession) {
      return res.status(404).json({ error: 'Swap session not found' });
    }
    if (parseInt(swapSession.user1_id) !== parseInt(req.user.id) && parseInt(swapSession.user2_id) !== parseInt(req.user.id)) {
      return res.status(403).json({ error: 'Not authorized to review this swap session' });
    }
    if (swapSession.status !== 'COMPLETED') {
      return res.status(400).json({ error: 'Can only review completed swap sessions' });
    }

    // Verify reviewee is the other user in the swap
    if (parseInt(reviewee_id) !== parseInt(swapSession.user1_id) && parseInt(reviewee_id) !== parseInt(swapSession.user2_id)) {
      return res.status(400).json({ error: 'Reviewee must be the other user in the swap' });
    }

    // Verify reviewer is not reviewing themselves
    if (parseInt(req.user.id) === parseInt(reviewee_id)) {
      return res.status(400).json({ error: 'Cannot review yourself' });
    }

    // Check if review already exists
    db.get(
      'SELECT * FROM reviews WHERE swap_session_id = ? AND reviewer_id = ? AND reviewee_id = ?',
      [swap_session_id, req.user.id, reviewee_id],
      (err, existing) => {
        if (err) {
          return res.status(500).json({ error: 'Database error' });
        }
        if (existing) {
          return res.status(400).json({ error: 'You have already reviewed this user for this swap' });
        }

        // Create review
        db.run(
          'INSERT INTO reviews (swap_session_id, reviewer_id, reviewee_id, rating, comment) VALUES (?, ?, ?, ?, ?)',
          [swap_session_id, req.user.id, reviewee_id, rating, comment || null],
          function(err) {
            if (err) {
              return res.status(500).json({ error: 'Error creating review' });
            }

            // Update reviewee's average rating
            db.all(
              'SELECT AVG(rating) as avg_rating FROM reviews WHERE reviewee_id = ?',
              [reviewee_id],
              (err, result) => {
                if (!err && result && result[0]) {
                  const newRating = result[0].avg_rating.toFixed(2);
                  db.run(
                    'UPDATE users SET rating = ? WHERE id = ?',
                    [newRating, reviewee_id],
                    (err) => {
                      if (err) {
                        console.error('Error updating user rating:', err);
                      }
                    }
                  );
                }
              }
            );

            res.status(201).json({ message: 'Review submitted successfully' });
          }
        );
      }
    );
  });
});

/**
 * Rate a user directly (without swap_session_id requirement)
 * POST /api/reviews/rate/:userId
 * Body: { rating: 1-5, comment?: string }
 * NOTE: This route must be defined BEFORE /user/:userId to avoid route conflicts
 */
router.post('/rate/:userId', authenticateToken, (req, res) => {
  console.log('Rating endpoint hit:', req.method, req.path);
  console.log('User ID param:', req.params.userId);
  console.log('Authenticated user ID:', req.user.id);
  
  const { rating, comment } = req.body;
  const reviewee_id = req.params.userId;
  const reviewer_id = req.user.id;

  console.log('Rating data:', { rating, comment, reviewee_id, reviewer_id });

  if (!rating) {
    return res.status(400).json({ error: 'Rating is required' });
  }

  if (rating < 1 || rating > 5) {
    return res.status(400).json({ error: 'Rating must be between 1 and 5' });
  }

  if (parseInt(reviewer_id) === parseInt(reviewee_id)) {
    return res.status(400).json({ error: 'Cannot rate yourself' });
  }

  const db = getDatabase();

  // Verify users have at least one completed swap together
  db.get(
    `SELECT * FROM swap_sessions 
     WHERE status = 'COMPLETED' 
     AND ((user1_id = ? AND user2_id = ?) OR (user1_id = ? AND user2_id = ?))`,
    [reviewer_id, reviewee_id, reviewee_id, reviewer_id],
    (err, swapSession) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }
      if (!swapSession) {
        return res.status(400).json({ error: 'You can only rate users you have completed swaps with' });
      }

      // Check if user has already rated this user (for this or any completed swap)
      db.get(
        `SELECT * FROM reviews 
         WHERE reviewer_id = ? AND reviewee_id = ? 
         AND EXISTS (
           SELECT 1 FROM swap_sessions ss 
           WHERE ss.id = reviews.swap_session_id 
           AND ss.status = 'COMPLETED'
           AND ((ss.user1_id = ? AND ss.user2_id = ?) OR (ss.user1_id = ? AND ss.user2_id = ?))
         )`,
        [reviewer_id, reviewee_id, reviewer_id, reviewee_id, reviewee_id, reviewer_id],
        (err, existing) => {
          if (err) {
            return res.status(500).json({ error: 'Database error' });
          }

          // Use the swap session we found for the review
          const swap_session_id = swapSession.id;

          if (existing) {
            // Update existing review
            db.run(
              'UPDATE reviews SET rating = ?, comment = ?, created_at = CURRENT_TIMESTAMP WHERE id = ?',
              [rating, comment || null, existing.id],
              function(err) {
                if (err) {
                  return res.status(500).json({ error: 'Error updating review' });
                }

                // Update reviewee's average rating
                updateUserRating(reviewee_id, () => {
                  res.json({ message: 'Rating updated successfully' });
                });
              }
            );
          } else {
            // Create new review
            db.run(
              'INSERT INTO reviews (swap_session_id, reviewer_id, reviewee_id, rating, comment) VALUES (?, ?, ?, ?, ?)',
              [swap_session_id, reviewer_id, reviewee_id, rating, comment || null],
              function(err) {
                if (err) {
                  return res.status(500).json({ error: 'Error creating review' });
                }

                // Update reviewee's average rating
                updateUserRating(reviewee_id, () => {
                  res.json({ message: 'Rating submitted successfully' });
                });
              }
            );
          }
        }
      );
    }
  );
});

/**
 * Get reviews for a swap session
 * GET /api/reviews/swap/:swapSessionId
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
    if (parseInt(swapSession.user1_id) !== parseInt(req.user.id) && parseInt(swapSession.user2_id) !== parseInt(req.user.id)) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    db.all(
      `SELECT r.*, 
              rev.username as reviewer_username, rev.full_name as reviewer_name,
              reviewee.username as reviewee_username, reviewee.full_name as reviewee_name
       FROM reviews r
       JOIN users rev ON r.reviewer_id = rev.id
       JOIN users reviewee ON r.reviewee_id = reviewee.id
       WHERE r.swap_session_id = ?
       ORDER BY r.created_at DESC`,
      [swapSessionId],
      (err, reviews) => {
        if (err) {
          return res.status(500).json({ error: 'Database error' });
        }
        res.json({ reviews });
      }
    );
  });
});

/**
 * Get reviews for a user
 * GET /api/reviews/user/:userId
 */
router.get('/user/:userId', authenticateToken, (req, res) => {
  const db = getDatabase();
  const userId = req.params.userId;

  db.all(
    `SELECT r.*, 
            rev.username as reviewer_username, rev.full_name as reviewer_name,
            ss.id as swap_session_id
     FROM reviews r
     JOIN users rev ON r.reviewer_id = rev.id
     JOIN swap_sessions ss ON r.swap_session_id = ss.id
     WHERE r.reviewee_id = ?
     ORDER BY r.created_at DESC`,
    [userId],
    (err, reviews) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }
      res.json({ reviews });
    }
  );
});

/**
 * Helper function to update user's average rating
 */
function updateUserRating(userId, callback) {
  const db = getDatabase();
  db.all(
    'SELECT AVG(rating) as avg_rating FROM reviews WHERE reviewee_id = ?',
    [userId],
    (err, result) => {
      if (!err && result && result[0] && result[0].avg_rating !== null) {
        const newRating = parseFloat(result[0].avg_rating).toFixed(2);
        db.run(
          'UPDATE users SET rating = ? WHERE id = ?',
          [newRating, userId],
          (err) => {
            if (err) {
              console.error('Error updating user rating:', err);
            }
            if (callback) callback();
          }
        );
      } else {
        if (callback) callback();
      }
    }
  );
}

module.exports = router;

