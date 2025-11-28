/**
 * Database Initialization Script
 * Creates SQLite database with all required tables
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const DB_PATH = path.join(__dirname, 'skill_swap.db');

/**
 * Initialize database connection and create tables
 */
function initDatabase() {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(DB_PATH, (err) => {
      if (err) {
        console.error('Error opening database:', err);
        reject(err);
        return;
      }
      console.log('Connected to SQLite database');
    });

    // Enable foreign keys
    db.run('PRAGMA foreign_keys = ON');

    // Create users table
    db.run(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        full_name TEXT,
        bio TEXT,
        profile_pic TEXT,
        rating REAL DEFAULT 0.0,
        total_swaps INTEGER DEFAULT 0,
        is_admin INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `, (err) => {
      if (err) {
        console.error('Error creating users table:', err);
        reject(err);
        return;
      }
      console.log('Users table created/verified');
    });

    // Create skills table (stores all skills offered/wanted by users)
    db.run(`
      CREATE TABLE IF NOT EXISTS skills (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        skill_name TEXT NOT NULL,
        skill_type TEXT NOT NULL CHECK(skill_type IN ('OFFER', 'WANT')),
        description TEXT,
        proficiency_level TEXT DEFAULT 'Beginner',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `, (err) => {
      if (err) {
        console.error('Error creating skills table:', err);
        reject(err);
        return;
      }
      console.log('Skills table created/verified');
    });

    // Create swap_requests table (tracks swap requests between users)
    db.run(`
      CREATE TABLE IF NOT EXISTS swap_requests (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        requester_id INTEGER NOT NULL,
        receiver_id INTEGER NOT NULL,
        requester_skill_id INTEGER NOT NULL,
        receiver_skill_id INTEGER NOT NULL,
        status TEXT DEFAULT 'PENDING' CHECK(status IN ('PENDING', 'ACCEPTED', 'REJECTED', 'CANCELLED')),
        message TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (requester_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (receiver_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (requester_skill_id) REFERENCES skills(id) ON DELETE CASCADE,
        FOREIGN KEY (receiver_skill_id) REFERENCES skills(id) ON DELETE CASCADE
      )
    `, (err) => {
      if (err) {
        console.error('Error creating swap_requests table:', err);
        reject(err);
        return;
      }
      console.log('Swap requests table created/verified');
    });

    // Create swap_sessions table (active swaps)
    db.run(`
      CREATE TABLE IF NOT EXISTS swap_sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        swap_request_id INTEGER NOT NULL UNIQUE,
        user1_id INTEGER NOT NULL,
        user2_id INTEGER NOT NULL,
        user1_skill_id INTEGER NOT NULL,
        user2_skill_id INTEGER NOT NULL,
        status TEXT DEFAULT 'ACTIVE' CHECK(status IN ('ACTIVE', 'COMPLETED', 'CANCELLED')),
        started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        completed_at DATETIME,
        FOREIGN KEY (swap_request_id) REFERENCES swap_requests(id) ON DELETE CASCADE,
        FOREIGN KEY (user1_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (user2_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (user1_skill_id) REFERENCES skills(id) ON DELETE CASCADE,
        FOREIGN KEY (user2_skill_id) REFERENCES skills(id) ON DELETE CASCADE
      )
    `, (err) => {
      if (err) {
        console.error('Error creating swap_sessions table:', err);
        reject(err);
        return;
      }
      console.log('Swap sessions table created/verified');
    });

    // Create sessions table (learning sessions scheduled within an active swap)
    db.run(`
      CREATE TABLE IF NOT EXISTS sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        swap_session_id INTEGER NOT NULL,
        teacher_id INTEGER NOT NULL,
        student_id INTEGER NOT NULL,
        topic TEXT NOT NULL,
        session_type TEXT NOT NULL CHECK(session_type IN ('Online', 'Offline')),
        scheduled_date DATETIME NOT NULL,
        duration_hours REAL DEFAULT 1.0,
        status TEXT DEFAULT 'SCHEDULED' CHECK(status IN ('SCHEDULED', 'COMPLETED', 'CANCELLED')),
        notes TEXT,
        meeting_link TEXT,
        place TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (swap_session_id) REFERENCES swap_sessions(id) ON DELETE CASCADE,
        FOREIGN KEY (teacher_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `, (err) => {
      if (err) {
        console.error('Error creating sessions table:', err);
        reject(err);
        return;
      }
      console.log('Sessions table created/verified');
    });

    // Create resources table (resources shared within active swaps)
    db.run(`
      CREATE TABLE IF NOT EXISTS resources (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        swap_session_id INTEGER NOT NULL,
        uploaded_by INTEGER NOT NULL,
        resource_type TEXT NOT NULL CHECK(resource_type IN ('Link', 'PDF', 'Note', 'Other')),
        title TEXT NOT NULL,
        content TEXT,
        file_path TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (swap_session_id) REFERENCES swap_sessions(id) ON DELETE CASCADE,
        FOREIGN KEY (uploaded_by) REFERENCES users(id) ON DELETE CASCADE
      )
    `, (err) => {
      if (err) {
        console.error('Error creating resources table:', err);
        reject(err);
        return;
      }
      console.log('Resources table created/verified');
    });

    // Create messages table (chat messages within active swaps)
    db.run(`
      CREATE TABLE IF NOT EXISTS messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        swap_session_id INTEGER NOT NULL,
        sender_id INTEGER NOT NULL,
        message_text TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (swap_session_id) REFERENCES swap_sessions(id) ON DELETE CASCADE,
        FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `, (err) => {
      if (err) {
        console.error('Error creating messages table:', err);
        reject(err);
        return;
      }
      console.log('Messages table created/verified');
    });

    // Create reviews table (reviews after swap completion)
    db.run(`
      CREATE TABLE IF NOT EXISTS reviews (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        swap_session_id INTEGER NOT NULL,
        reviewer_id INTEGER NOT NULL,
        reviewee_id INTEGER NOT NULL,
        rating INTEGER NOT NULL CHECK(rating >= 1 AND rating <= 5),
        comment TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (swap_session_id) REFERENCES swap_sessions(id) ON DELETE CASCADE,
        FOREIGN KEY (reviewer_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (reviewee_id) REFERENCES users(id) ON DELETE CASCADE,
        UNIQUE(swap_session_id, reviewer_id, reviewee_id)
      )
    `, (err) => {
      if (err) {
        console.error('Error creating reviews table:', err);
        reject(err);
        return;
      }
      console.log('Reviews table created/verified');
    });

    // Close database connection after all tables are created
    db.close((err) => {
      if (err) {
        console.error('Error closing database:', err);
        reject(err);
        return;
      }
      console.log('Database initialization complete');
      resolve();
    });
  });
}

module.exports = { initDatabase, DB_PATH };

