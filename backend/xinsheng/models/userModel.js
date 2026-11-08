// Model: users table (parents, kids, stall owners)
const pool = require("../../config/db");

// active kid by username, any letter case
async function findActiveChildByUsername(username) {
  const { rows } = await pool.query(
    `SELECT user_id, username, display_name, avatar_emoji, password_hash, failed_pin_tries,
            COALESCE(locked_until > now(), false) AS locked,
            GREATEST(CEIL(EXTRACT(EPOCH FROM locked_until - now())), 0)::int AS lock_seconds
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

// new PIN also unlocks the kid
async function updatePasswordHash(userId, hash) {
  await pool.query(
    `UPDATE users SET password_hash = $1, failed_pin_tries = 0, locked_until = NULL WHERE user_id = $2`,
    [hash, userId]
  );
}

// one statement so two wrong tries at the same time both count
// on the last try it locks and starts counting from 0 again
async function recordWrongPin(userId, maxTries, lockMinutes) {
  const { rows } = await pool.query(
    `UPDATE users
        SET failed_pin_tries = CASE WHEN failed_pin_tries + 1 >= $2 THEN 0 ELSE failed_pin_tries + 1 END,
            locked_until = CASE WHEN failed_pin_tries + 1 >= $2 THEN now() + make_interval(mins => $3)
                                ELSE locked_until END
      WHERE user_id = $1
      RETURNING failed_pin_tries, COALESCE(locked_until > now(), false) AS locked,
                GREATEST(CEIL(EXTRACT(EPOCH FROM locked_until - now())), 0)::int AS lock_seconds`,
    [userId, maxTries, lockMinutes]
  );
  return rows[0];
}

async function clearPinTries(userId) {
  await pool.query(`UPDATE users SET failed_pin_tries = 0 WHERE user_id = $1`, [userId]);
}

async function getLockedChildIds(childIds) {
  const { rows } = await pool.query(
    `SELECT user_id FROM users WHERE user_id = ANY($1::int[]) AND locked_until > now()`,
    [childIds]
  );
  return rows.map((r) => r.user_id);
}

module.exports = {
  findActiveChildByUsername, findActiveParentByEmail, createParent, updatePasswordHash,
  recordWrongPin, clearPinTries, getLockedChildIds,
};
