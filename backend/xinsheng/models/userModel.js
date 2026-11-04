// Model: users table (parents, kids, stall owners)
const pool = require("../../config/db");

// active kid by username, any letter case
async function findActiveChildByUsername(username) {
  const { rows } = await pool.query(
    `SELECT user_id, username, display_name, avatar_emoji, password_hash
       FROM users
      WHERE role = 'child' AND is_active AND LOWER(username) = LOWER($1)`,
    [username]
  );
  return rows[0];
}

// active parent by email, any letter case (used by Leroy's parent login)
async function findActiveParentByEmail(email) {
  const { rows } = await pool.query(
    `SELECT user_id, display_name, email, password_hash
       FROM users
      WHERE role = 'parent' AND is_active AND LOWER(email) = LOWER($1)`,
    [email]
  );
  return rows[0];
}

// new parent account (used by Leroy's parent sign up); email must be unique
async function createParent(name, email, phone, passwordHash) {
  const { rows } = await pool.query(
    `INSERT INTO users (role, display_name, email, phone, password_hash)
     VALUES ('parent', $1, $2, $3, $4)
     RETURNING user_id, display_name, email`,
    [name, email, phone, passwordHash]
  );
  return rows[0];
}

async function updatePasswordHash(userId, hash) {
  await pool.query(`UPDATE users SET password_hash = $1 WHERE user_id = $2`, [hash, userId]);
}

module.exports = { findActiveChildByUsername, findActiveParentByEmail, createParent, updatePasswordHash };
