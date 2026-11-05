// Model: a new kid's login (users), profile (child_profiles) and allergies (child_allergies), saved together
const pool = require("../../config/db");

// one transaction, so a kid is never saved without their allergies
async function createChild(parentId, { name, username, pinHash, dailyLimit, allergenNames }) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const { rows } = await client.query(
      `INSERT INTO users (role, display_name, username, password_hash)
       VALUES ('child', $1, $2, $3)
       RETURNING user_id`,
      [name, username, pinHash]
    );
    const childId = rows[0].user_id;
    await client.query(
      `INSERT INTO child_profiles (child_id, parent_id, daily_limit) VALUES ($1, $2, $3)`,
      [childId, parentId, dailyLimit]
    );
    if (allergenNames.length) {
      const res = await client.query(
        `INSERT INTO child_allergies (child_id, allergen_id)
         SELECT $1, allergen_id FROM allergens WHERE name = ANY($2::text[])`,
        [childId, allergenNames]
      );
      if (res.rowCount !== allergenNames.length) throw new Error("Allergen missing from allergens table");
    }
    await client.query("COMMIT");
    return childId;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

// a parent's kids for the parent home: wallet, daily limit, allergies, and food money spent today (Singapore day)
async function listForParent(parentId) {
  const { rows } = await pool.query(
    `SELECT c.child_id, u.display_name, u.avatar_emoji, c.wallet_balance, c.daily_limit,
            ARRAY(SELECT a.name FROM child_allergies ca JOIN allergens a ON a.allergen_id = ca.allergen_id
                   WHERE ca.child_id = c.child_id ORDER BY a.allergen_id) AS allergens,
            (SELECT COALESCE(SUM(o.total_amount), 0) FROM orders o
              WHERE o.child_id = c.child_id AND o.status <> 'cancelled'
                AND o.placed_at >= date_trunc('day', now() AT TIME ZONE 'Asia/Singapore') AT TIME ZONE 'Asia/Singapore'
            ) AS spent_today
       FROM child_profiles c JOIN users u ON u.user_id = c.child_id
      WHERE c.parent_id = $1 AND u.is_active
      ORDER BY c.child_id`,
    [parentId]
  );
  return rows;
}

// replaces a kid's allergies in one transaction, so a failed save never leaves them with none
async function setAllergies(childId, allergenNames) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(`DELETE FROM child_allergies WHERE child_id = $1`, [childId]);
    if (allergenNames.length) {
      const res = await client.query(
        `INSERT INTO child_allergies (child_id, allergen_id)
         SELECT $1, allergen_id FROM allergens WHERE name = ANY($2::text[])`,
        [childId, allergenNames]
      );
      if (res.rowCount !== allergenNames.length) throw new Error("Allergen missing from allergens table");
    }
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

async function setDailyLimit(childId, dailyLimit) {
  await pool.query(`UPDATE child_profiles SET daily_limit = $2 WHERE child_id = $1`, [childId, dailyLimit]);
}

module.exports = { createChild, listForParent, setAllergies, setDailyLimit };
