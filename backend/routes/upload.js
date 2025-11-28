/**
 * Upload Routes
 * Handles file uploads (profile pictures)
 */

const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { authenticateToken } = require('../middleware/auth');
const { getDatabase } = require('../database/db');

const router = express.Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../uploads/profile_pics');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, `profile-${req.user.id}-${uniqueSuffix}${path.extname(file.originalname)}`);
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (extname && mimetype) {
      cb(null, true);
    } else {
      cb(new Error('Only image files (jpeg, jpg, png, gif, webp) are allowed!'));
    }
  }
});

/**
 * Upload profile picture
 * POST /api/upload/profile-pic
 */
router.post('/profile-pic', authenticateToken, upload.single('profile_pic'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  const db = getDatabase();
  const profilePicPath = `/uploads/profile_pics/${req.file.filename}`;

  // Update user profile picture
  db.run(
    'UPDATE users SET profile_pic = ? WHERE id = ?',
    [profilePicPath, req.user.id],
    function(err) {
      if (err) {
        // Delete uploaded file if database update fails
        fs.unlinkSync(req.file.path);
        return res.status(500).json({ error: 'Error updating profile picture' });
      }

      // Delete old profile picture if exists
      db.get('SELECT profile_pic FROM users WHERE id = ?', [req.user.id], (err, user) => {
        if (!err && user && user.profile_pic && user.profile_pic !== profilePicPath) {
          const oldPath = path.join(__dirname, '..', user.profile_pic);
          if (fs.existsSync(oldPath)) {
            fs.unlinkSync(oldPath);
          }
        }
      });

      res.json({
        message: 'Profile picture uploaded successfully',
        profile_pic: profilePicPath
      });
    }
  );
});

module.exports = router;

