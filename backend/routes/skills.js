/**
 * Skills Routes
 * Handles CRUD operations for user skills (OFFER/WANT)
 */

const express = require('express');
const { getDatabase } = require('../database/db');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

/**
 * Get all skills for a user
 * GET /api/skills/user/:userId
 */
router.get('/user/:userId', authenticateToken, (req, res) => {
  const db = getDatabase();
  const userId = req.params.userId;

  db.all(
    'SELECT * FROM skills WHERE user_id = ? ORDER BY skill_type, created_at DESC',
    [userId],
    (err, skills) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }
      res.json(skills);
    }
  );
});

/**
 * Get all skills (for matching purposes)
 * GET /api/skills
 */
router.get('/', authenticateToken, (req, res) => {
  const db = getDatabase();

  db.all(
    `SELECT s.*, u.username, u.full_name, u.rating 
     FROM skills s 
     JOIN users u ON s.user_id = u.id 
     ORDER BY s.created_at DESC`,
    [],
    (err, skills) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }
      res.json(skills);
    }
  );
});

/**
 * Add a new skill
 * POST /api/skills
 */
router.post('/', authenticateToken, (req, res) => {
  const { skill_name, skill_type, description, proficiency_level } = req.body;

  if (!skill_name || !skill_type) {
    return res.status(400).json({ error: 'Skill name and type (OFFER/WANT) are required' });
  }

  if (!['OFFER', 'WANT'].includes(skill_type)) {
    return res.status(400).json({ error: 'Skill type must be OFFER or WANT' });
  }

  const db = getDatabase();

  db.run(
    'INSERT INTO skills (user_id, skill_name, skill_type, description, proficiency_level) VALUES (?, ?, ?, ?, ?)',
    [req.user.id, skill_name, skill_type, description || null, proficiency_level || 'Beginner'],
    function(err) {
      if (err) {
        return res.status(500).json({ error: 'Error adding skill' });
      }

      // Get the created skill
      db.get('SELECT * FROM skills WHERE id = ?', [this.lastID], (err, skill) => {
        if (err) {
          return res.status(500).json({ error: 'Error fetching created skill' });
        }
        res.status(201).json({ message: 'Skill added successfully', skill });
      });
    }
  );
});

/**
 * Update a skill
 * PUT /api/skills/:id
 */
router.put('/:id', authenticateToken, (req, res) => {
  const { skill_name, skill_type, description, proficiency_level } = req.body;
  const skillId = req.params.id;

  const db = getDatabase();

  // Check if skill belongs to user
  db.get('SELECT * FROM skills WHERE id = ? AND user_id = ?', [skillId, req.user.id], (err, skill) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    if (!skill) {
      return res.status(404).json({ error: 'Skill not found or unauthorized' });
    }

    // Update skill
    db.run(
      'UPDATE skills SET skill_name = ?, skill_type = ?, description = ?, proficiency_level = ? WHERE id = ?',
      [
        skill_name || skill.skill_name,
        skill_type || skill.skill_type,
        description !== undefined ? description : skill.description,
        proficiency_level || skill.proficiency_level,
        skillId
      ],
      function(err) {
        if (err) {
          return res.status(500).json({ error: 'Error updating skill' });
        }

        db.get('SELECT * FROM skills WHERE id = ?', [skillId], (err, updatedSkill) => {
          if (err) {
            return res.status(500).json({ error: 'Error fetching updated skill' });
          }
          res.json({ message: 'Skill updated successfully', skill: updatedSkill });
        });
      }
    );
  });
});

/**
 * Delete a skill
 * DELETE /api/skills/:id
 */
router.delete('/:id', authenticateToken, (req, res) => {
  const skillId = req.params.id;
  const db = getDatabase();

  // Check if skill belongs to user
  db.get('SELECT * FROM skills WHERE id = ? AND user_id = ?', [skillId, req.user.id], (err, skill) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    if (!skill) {
      return res.status(404).json({ error: 'Skill not found or unauthorized' });
    }

    db.run('DELETE FROM skills WHERE id = ?', [skillId], function(err) {
      if (err) {
        return res.status(500).json({ error: 'Error deleting skill' });
      }
      res.json({ message: 'Skill deleted successfully' });
    });
  });
});

module.exports = router;

