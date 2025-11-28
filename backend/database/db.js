/**
 * Database Connection Module
 * Provides a singleton database connection
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const { DB_PATH } = require('./init');

let db = null;

/**
 * Get database connection (singleton pattern)
 */
function getDatabase() {
  if (!db) {
    db = new sqlite3.Database(DB_PATH, (err) => {
      if (err) {
        console.error('Error opening database:', err);
        throw err;
      }
      // Enable foreign keys
      db.run('PRAGMA foreign_keys = ON');
      // Ensure data is written to disk immediately (synchronous mode)
      db.run('PRAGMA synchronous = FULL');
      // Use WAL mode for better concurrency and data safety
      db.run('PRAGMA journal_mode = WAL');
    });
  }
  return db;
}

/**
 * Close database connection
 */
function closeDatabase() {
  if (db) {
    db.close((err) => {
      if (err) {
        console.error('Error closing database:', err);
      } else {
        console.log('Database connection closed');
        db = null;
      }
    });
  }
}

module.exports = { getDatabase, closeDatabase };

