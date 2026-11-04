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

async function updatePasswordHash(userId, hash) {
  await pool.query(`UPDATE users SET password_hash = $1 WHERE user_id = $2`, [hash, userId]);
}

module.exports = { findActiveChildByUsername, updatePasswordHash };
