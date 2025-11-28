/**
 * Database Backup Script
 * Creates a backup of the SQLite database
 */

const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');
const { DB_PATH } = require('../database/init');

const BACKUP_DIR = path.join(__dirname, '../database/backups');

// Create backups directory if it doesn't exist
if (!fs.existsSync(BACKUP_DIR)) {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const backupPath = path.join(BACKUP_DIR, `skill_swap_backup_${timestamp}.db`);
const sqlDumpPath = path.join(BACKUP_DIR, `skill_swap_backup_${timestamp}.sql`);

console.log('Creating database backup...');

// Create .db backup (copy file)
fs.copyFileSync(DB_PATH, backupPath);
console.log(`✓ Database file backup created: ${backupPath}`);

// Create SQL dump backup
const db = new sqlite3.Database(DB_PATH);
const sqlDump = [];

db.serialize(() => {
  // Get all data
  db.each('SELECT name, sql FROM sqlite_master WHERE type="table"', (err, row) => {
    if (err) {
      console.error('Error:', err);
      return;
    }
    if (row.name !== 'sqlite_sequence') {
      sqlDump.push(row.sql + ';');
    }
  }, () => {
    // Dump table data
    const tables = ['users', 'skills', 'swap_requests', 'swap_sessions', 'sessions', 'resources', 'messages', 'reviews'];
    let completed = 0;
    
    tables.forEach(table => {
      db.all(`SELECT * FROM ${table}`, (err, rows) => {
        if (!err && rows.length > 0) {
          sqlDump.push(`\n-- Data for table: ${table}`);
          rows.forEach(row => {
            const keys = Object.keys(row);
            const values = keys.map(k => {
              const v = row[k];
              return typeof v === 'string' ? `'${v.replace(/'/g, "''")}'` : (v === null ? 'NULL' : v);
            });
            sqlDump.push(`INSERT INTO ${table} (${keys.join(', ')}) VALUES (${values.join(', ')});`);
          });
        }
        completed++;
        if (completed === tables.length) {
          fs.writeFileSync(sqlDumpPath, sqlDump.join('\n'));
          console.log(`✓ SQL dump backup created: ${sqlDumpPath}`);
          db.close();
          console.log('Backup completed successfully!');
        }
      });
    });
  });
});

