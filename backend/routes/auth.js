/**
 * Authentication Routes
 * Handles user registration and login
 */

const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { getDatabase } = require('../database/db');

const router = express.Router();

/**
 * Register a new user
 * POST /api/auth/register
 */
router.post('/register', async (req, res) => {
  try {
    const { username, email, password, full_name, bio, is_admin, profile_pic } = req.body;

    // Validation
    if (!username || !email || !password) {
      return res.status(400).json({ error: 'Username, email, and password are required' });
    }

    const db = getDatabase();

    // Check if user already exists
    db.get('SELECT * FROM users WHERE email = ? OR username = ?', [email, username], async (err, user) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }

      if (user) {
        return res.status(400).json({ error: 'User already exists with this email or username' });
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(password, 10);

      // Determine admin status - allow admin registration with special flag
      const adminStatus = is_admin === true || is_admin === 1 || is_admin === '1' ? 1 : 0;

      // Insert new user
      db.run(
        'INSERT INTO users (username, email, password, full_name, bio, profile_pic, is_admin) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [username, email, hashedPassword, full_name || null, bio || null, profile_pic || null, adminStatus],
        function(err) {
          if (err) {
            return res.status(500).json({ error: 'Error creating user' });
          }

          // Generate JWT token
          const token = jwt.sign(
            { id: this.lastID, username, email, is_admin: adminStatus },
            process.env.JWT_SECRET || 'your_super_secret_jwt_key_change_this_in_production',
            { expiresIn: '7d' }
          );

          res.status(201).json({
            message: 'User registered successfully',
            token,
            user: {
              id: this.lastID,
              username,
              email,
              full_name,
              bio,
              profile_pic: profile_pic || null,
              is_admin: adminStatus
            }
          });
        }
      );
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error during registration' });
  }
});

/**
 * Login user
 * POST /api/auth/login
 */
router.post('/login', (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const db = getDatabase();

    // Find user by email
    db.get('SELECT * FROM users WHERE email = ?', [email], async (err, user) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }

      if (!user) {
        return res.status(401).json({ error: 'Invalid email or password' });
      }

      // Verify password
      const validPassword = await bcrypt.compare(password, user.password);
      if (!validPassword) {
        return res.status(401).json({ error: 'Invalid email or password' });
      }

      // Generate JWT token
      const token = jwt.sign(
        { id: user.id, username: user.username, email: user.email, is_admin: user.is_admin },
        process.env.JWT_SECRET || 'your_super_secret_jwt_key_change_this_in_production',
        { expiresIn: '7d' }
      );

      res.json({
        message: 'Login successful',
        token,
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          full_name: user.full_name,
          bio: user.bio,
          profile_pic: user.profile_pic || null,
          rating: user.rating,
          total_swaps: user.total_swaps,
          is_admin: user.is_admin
        }
      });
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error during login' });
  }
});

/**
 * Get current user profile
 * GET /api/auth/me
 */
router.get('/me', require('../middleware/auth').authenticateToken, (req, res) => {
  const db = getDatabase();
  
  db.get('SELECT id, username, email, full_name, bio, profile_pic, rating, total_swaps, is_admin FROM users WHERE id = ?', 
    [req.user.id], 
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

module.exports = router;

