/**
 * Matching Routes
 * Handles skill matching logic (unidirectional matching - shows matches if either direction matches)
 */

const express = require('express');
const { getDatabase } = require('../database/db');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

/**
 * Get matched users for current user
 * Unidirectional matching: Show matches if:
 * - They offer something I want, OR
 * - I offer something they want
 * GET /api/matching/matches
 */
router.get('/matches', authenticateToken, (req, res) => {
  const db = getDatabase();
  const userId = req.user.id;

  // Query for unidirectional matching - show matches if either direction matches
  // Find users where:
  // 1. They offer something I want, OR
  // 2. I offer something they want
  const query = `
    SELECT DISTINCT
      u.id as matched_user_id,
      u.username,
      u.full_name,
      u.rating,
      u.bio,
      -- Skills they offer that I want
      GROUP_CONCAT(DISTINCT CASE 
        WHEN s1.skill_type = 'OFFER' AND my_want.skill_type = 'WANT' 
        THEN s1.skill_name || ' (OFFER)' 
        ELSE NULL 
      END) as skills_they_offer_that_i_want,
      -- Skills I offer that they want
      GROUP_CONCAT(DISTINCT CASE 
        WHEN s2.skill_type = 'OFFER' AND their_want.skill_type = 'WANT'
        THEN s2.skill_name || ' (OFFER)'
        ELSE NULL
      END) as skills_i_offer_that_they_want
    FROM users u
    -- Left join for skills they offer that I want
    LEFT JOIN skills s1 ON u.id = s1.user_id AND s1.skill_type = 'OFFER'
    LEFT JOIN skills my_want ON my_want.user_id = ? AND my_want.skill_type = 'WANT'
      AND LOWER(my_want.skill_name) = LOWER(s1.skill_name)
    -- Left join for skills I offer that they want
    LEFT JOIN skills s2 ON s2.user_id = ? AND s2.skill_type = 'OFFER'
    LEFT JOIN skills their_want ON their_want.user_id = u.id AND their_want.skill_type = 'WANT'
      AND LOWER(their_want.skill_name) = LOWER(s2.skill_name)
    WHERE u.id != ?
      AND (my_want.id IS NOT NULL OR their_want.id IS NOT NULL)
    GROUP BY u.id, u.username, u.full_name, u.rating, u.bio
    ORDER BY u.rating DESC, u.username
  `;

  db.all(query, [userId, userId, userId], (err, matches) => {
    if (err) {
      console.error('Matching error:', err);
      return res.status(500).json({ error: 'Database error during matching' });
    }

    // Format the results better
    const formattedMatches = matches.map(match => ({
      user: {
        id: match.matched_user_id,
        username: match.username,
        full_name: match.full_name,
        rating: match.rating,
        bio: match.bio
      },
      matching_skills: {
        they_offer_that_i_want: match.skills_they_offer_that_i_want 
          ? match.skills_they_offer_that_i_want.split(', ').filter(s => s && s !== 'NULL') 
          : [],
        i_offer_that_they_want: match.skills_i_offer_that_they_want 
          ? match.skills_i_offer_that_they_want.split(', ').filter(s => s && s !== 'NULL') 
          : []
      }
    }));

    res.json({ matches: formattedMatches });
  });
});

/**
 * Get detailed matching info with skill IDs
 * Returns skills even if only one direction matches
 * GET /api/matching/details/:matchedUserId
 */
router.get('/details/:matchedUserId', authenticateToken, (req, res) => {
  const db = getDatabase();
  const userId = req.user.id;
  const matchedUserId = req.params.matchedUserId;

  // Get skills they offer that I want
  const query1 = `
    SELECT s1.id, s1.skill_name, s1.description, s1.proficiency_level
    FROM skills s1
    INNER JOIN skills my_want ON my_want.user_id = ? AND my_want.skill_type = 'WANT'
      AND LOWER(my_want.skill_name) = LOWER(s1.skill_name)
    WHERE s1.user_id = ? AND s1.skill_type = 'OFFER'
  `;

  // Get skills I offer that they want
  const query2 = `
    SELECT s2.id, s2.skill_name, s2.description, s2.proficiency_level
    FROM skills s2
    INNER JOIN skills their_want ON their_want.user_id = ? AND their_want.skill_type = 'WANT'
      AND LOWER(their_want.skill_name) = LOWER(s2.skill_name)
    WHERE s2.user_id = ? AND s2.skill_type = 'OFFER'
  `;

  // Get all skills they offer (even if I don't want them)
  const query3 = `
    SELECT id, skill_name, description, proficiency_level
    FROM skills
    WHERE user_id = ? AND skill_type = 'OFFER'
  `;

  // Get all skills I offer (even if they don't want them)
  const query4 = `
    SELECT id, skill_name, description, proficiency_level
    FROM skills
    WHERE user_id = ? AND skill_type = 'OFFER'
  `;

  db.all(query1, [userId, matchedUserId], (err, theirOffers) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }

    db.all(query2, [matchedUserId, userId], (err, myOffers) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }

      db.all(query3, [matchedUserId], (err, allTheirOffers) => {
        if (err) {
          return res.status(500).json({ error: 'Database error' });
        }

        db.all(query4, [userId], (err, allMyOffers) => {
          if (err) {
            return res.status(500).json({ error: 'Database error' });
          }

          // Get matched user info
          db.get('SELECT id, username, full_name, rating, bio FROM users WHERE id = ?', 
            [matchedUserId], 
            (err, matchedUser) => {
              if (err) {
                return res.status(500).json({ error: 'Database error' });
              }

              res.json({
                matched_user: matchedUser,
                their_offers_that_i_want: theirOffers,
                my_offers_that_they_want: myOffers,
                all_their_offers: allTheirOffers,
                all_my_offers: allMyOffers
              });
            }
          );
        });
      });
    });
  });
});

module.exports = router;

