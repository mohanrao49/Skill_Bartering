/**
 * Seed Data Script
 * Populates database with sample data for testing
 */

require('dotenv').config();
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const path = require('path');

const DB_PATH = path.join(__dirname, '..', 'database', 'skill_swap.db');

async function seedDatabase() {
  const db = new sqlite3.Database(DB_PATH);

  // Enable foreign keys
  db.run('PRAGMA foreign_keys = ON');

  // Hash password for all users
  const hashedPassword = await bcrypt.hash('password123', 10);

  console.log('Starting database seeding...');

  // Clear existing data (in reverse order of dependencies)
  db.serialize(() => {
    db.run('DELETE FROM reviews');
    db.run('DELETE FROM messages');
    db.run('DELETE FROM resources');
    db.run('DELETE FROM sessions');
    db.run('DELETE FROM swap_sessions');
    db.run('DELETE FROM swap_requests');
    db.run('DELETE FROM skills');
    db.run('DELETE FROM users');

    // Insert users
    db.run(
      `INSERT INTO users (id, username, email, password, full_name, bio, rating, total_swaps, is_admin)
       VALUES (1, 'admin', 'admin@skillswap.com', ?, 'Admin User', 'Platform Administrator', 5.0, 0, 1)`,
      [hashedPassword]
    );

    db.run(
      `INSERT INTO users (id, username, email, password, full_name, bio, rating, total_swaps)
       VALUES (2, 'john_doe', 'john@example.com', ?, 'John Doe', 'Full-stack developer with 5 years experience. Love teaching programming!', 4.8, 3)`,
      [hashedPassword]
    );

    db.run(
      `INSERT INTO users (id, username, email, password, full_name, bio, rating, total_swaps)
       VALUES (3, 'jane_smith', 'jane@example.com', ?, 'Jane Smith', 'Graphic designer and digital artist. Passionate about UI/UX design.', 4.9, 5)`,
      [hashedPassword]
    );

    db.run(
      `INSERT INTO users (id, username, email, password, full_name, bio, rating, total_swaps)
       VALUES (4, 'mike_wilson', 'mike@example.com', ?, 'Mike Wilson', 'Photography enthusiast and professional photographer.', 4.5, 2)`,
      [hashedPassword]
    );

    db.run(
      `INSERT INTO users (id, username, email, password, full_name, bio, rating, total_swaps)
       VALUES (5, 'sarah_jones', 'sarah@example.com', ?, 'Sarah Jones', 'Language tutor specializing in Spanish and French.', 4.7, 4)`,
      [hashedPassword]
    );

    // Insert skills
    // John's skills
    db.run(`INSERT INTO skills (id, user_id, skill_name, skill_type, description, proficiency_level)
            VALUES (1, 2, 'JavaScript', 'OFFER', 'Expert in React, Node.js, and modern JavaScript', 'Advanced')`);
    db.run(`INSERT INTO skills (id, user_id, skill_name, skill_type, description, proficiency_level)
            VALUES (2, 2, 'Python', 'OFFER', 'Data science and web development', 'Intermediate')`);
    db.run(`INSERT INTO skills (id, user_id, skill_name, skill_type, description, proficiency_level)
            VALUES (3, 2, 'Graphic Design', 'WANT', 'Want to learn UI/UX design basics', 'Beginner')`);
    db.run(`INSERT INTO skills (id, user_id, skill_name, skill_type, description, proficiency_level)
            VALUES (4, 2, 'Photography', 'WANT', 'Interested in portrait photography', 'Beginner')`);

    // Jane's skills
    db.run(`INSERT INTO skills (id, user_id, skill_name, skill_type, description, proficiency_level)
            VALUES (5, 3, 'Graphic Design', 'OFFER', 'Adobe Photoshop, Illustrator, Figma expert', 'Advanced')`);
    db.run(`INSERT INTO skills (id, user_id, skill_name, skill_type, description, proficiency_level)
            VALUES (6, 3, 'UI/UX Design', 'OFFER', 'User interface and experience design', 'Advanced')`);
    db.run(`INSERT INTO skills (id, user_id, skill_name, skill_type, description, proficiency_level)
            VALUES (7, 3, 'JavaScript', 'WANT', 'Want to learn web development', 'Beginner')`);
    db.run(`INSERT INTO skills (id, user_id, skill_name, skill_type, description, proficiency_level)
            VALUES (8, 3, 'Spanish', 'WANT', 'Want to learn conversational Spanish', 'Beginner')`);

    // Mike's skills
    db.run(`INSERT INTO skills (id, user_id, skill_name, skill_type, description, proficiency_level)
            VALUES (9, 4, 'Photography', 'OFFER', 'Portrait, landscape, and event photography', 'Advanced')`);
    db.run(`INSERT INTO skills (id, user_id, skill_name, skill_type, description, proficiency_level)
            VALUES (10, 4, 'Photo Editing', 'OFFER', 'Adobe Lightroom and Photoshop', 'Intermediate')`);
    db.run(`INSERT INTO skills (id, user_id, skill_name, skill_type, description, proficiency_level)
            VALUES (11, 4, 'JavaScript', 'WANT', 'Want to build a portfolio website', 'Beginner')`);

    // Sarah's skills
    db.run(`INSERT INTO skills (id, user_id, skill_name, skill_type, description, proficiency_level)
            VALUES (12, 5, 'Spanish', 'OFFER', 'Native speaker, conversational and business Spanish', 'Advanced')`);
    db.run(`INSERT INTO skills (id, user_id, skill_name, skill_type, description, proficiency_level)
            VALUES (13, 5, 'French', 'OFFER', 'Fluent in French, can teach basics to intermediate', 'Intermediate')`);
    db.run(`INSERT INTO skills (id, user_id, skill_name, skill_type, description, proficiency_level)
            VALUES (14, 5, 'Graphic Design', 'WANT', 'Want to create marketing materials', 'Beginner')`);

    // Create some swap requests
    // John wants Graphic Design, Jane wants JavaScript - MATCH!
    db.run(`INSERT INTO swap_requests (id, requester_id, receiver_id, requester_skill_id, receiver_skill_id, status, message)
            VALUES (1, 2, 3, 1, 5, 'ACCEPTED', 'Hi Jane! I saw you offer graphic design and I want to learn it. I can teach you JavaScript in return!')`);

    // Create active swap session from accepted request
    db.run(`INSERT INTO swap_sessions (id, swap_request_id, user1_id, user2_id, user1_skill_id, user2_skill_id, status, started_at)
            VALUES (1, 1, 2, 3, 1, 5, 'ACTIVE', datetime('now', '-5 days'))`);

    // Create some learning sessions
    db.run(`INSERT INTO sessions (id, swap_session_id, teacher_id, student_id, topic, session_type, scheduled_date, duration_hours, status, notes)
            VALUES (1, 1, 3, 2, 'Introduction to Figma', 'Online', datetime('now', '+2 days'), 2.0, 'SCHEDULED', 'We will cover basic tools and workspace')`);
    
    db.run(`INSERT INTO sessions (id, swap_session_id, teacher_id, student_id, topic, session_type, scheduled_date, duration_hours, status, notes)
            VALUES (2, 1, 2, 3, 'JavaScript Fundamentals', 'Online', datetime('now', '+3 days'), 2.5, 'SCHEDULED', 'Variables, functions, and DOM manipulation')`);

    db.run(`INSERT INTO sessions (id, swap_session_id, teacher_id, student_id, topic, session_type, scheduled_date, duration_hours, status, notes)
            VALUES (3, 1, 3, 2, 'Color Theory and Typography', 'Online', datetime('now', '-2 days'), 1.5, 'COMPLETED', 'Great session! John learned a lot.')`);

    // Create some messages
    db.run(`INSERT INTO messages (id, swap_session_id, sender_id, message_text, created_at)
            VALUES (1, 1, 2, 'Hi Jane! Thanks for accepting my swap request. Looking forward to learning from you!', datetime('now', '-4 days'))`);
    
    db.run(`INSERT INTO messages (id, swap_session_id, sender_id, message_text, created_at)
            VALUES (2, 1, 3, 'Hi John! No problem, I am excited to learn JavaScript from you too!', datetime('now', '-4 days', '+1 hour'))`);

    db.run(`INSERT INTO messages (id, swap_session_id, sender_id, message_text, created_at)
            VALUES (3, 1, 2, 'When would be a good time for our first session?', datetime('now', '-3 days'))`);

    // Create some resources
    db.run(`INSERT INTO resources (id, swap_session_id, uploaded_by, resource_type, title, content, created_at)
            VALUES (1, 1, 3, 'Link', 'Figma Tutorial for Beginners', 'https://www.figma.com/resources/learn-design/', datetime('now', '-3 days'))`);
    
    db.run(`INSERT INTO resources (id, swap_session_id, uploaded_by, resource_type, title, content, created_at)
            VALUES (2, 1, 2, 'Link', 'MDN JavaScript Guide', 'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide', datetime('now', '-2 days'))`);

    db.run(`INSERT INTO resources (id, swap_session_id, uploaded_by, resource_type, title, content, created_at)
            VALUES (3, 1, 3, 'Note', 'Color Theory Quick Reference', 'Primary Colors: Red, Blue, Yellow\nSecondary Colors: Orange, Green, Purple\nWarm Colors: Red, Orange, Yellow\nCool Colors: Blue, Green, Purple', datetime('now', '-1 day'))`);

    // Create a completed swap for reviews
    db.run(`INSERT INTO swap_requests (id, requester_id, receiver_id, requester_skill_id, receiver_skill_id, status, message)
            VALUES (2, 4, 2, 9, 1, 'ACCEPTED', 'Want to learn JavaScript for my portfolio')`);

    db.run(`INSERT INTO swap_sessions (id, swap_request_id, user1_id, user2_id, user1_skill_id, user2_skill_id, status, started_at, completed_at)
            VALUES (2, 2, 4, 2, 9, 1, 'COMPLETED', datetime('now', '-30 days'), datetime('now', '-5 days'))`);

    // Create reviews for completed swap
    db.run(`INSERT INTO reviews (id, swap_session_id, reviewer_id, reviewee_id, rating, comment, created_at)
            VALUES (1, 2, 2, 4, 5, 'Mike is an excellent photographer and great teacher! Learned so much about portrait photography.', datetime('now', '-4 days'))`);

    db.run(`INSERT INTO reviews (id, swap_session_id, reviewer_id, reviewee_id, rating, comment, created_at)
            VALUES (2, 2, 4, 2, 5, 'John taught me JavaScript really well. My portfolio website is now live thanks to him!', datetime('now', '-4 days'))`);

    console.log('Database seeded successfully!');
    console.log('\nSample accounts created:');
    console.log('Admin: admin@skillswap.com / password123');
    console.log('User 1: john@example.com / password123');
    console.log('User 2: jane@example.com / password123');
    console.log('User 3: mike@example.com / password123');
    console.log('User 4: sarah@example.com / password123');

    db.close();
  });
}

// Run seed script
seedDatabase().catch(console.error);

