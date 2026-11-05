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

module.exports = { createChild };
