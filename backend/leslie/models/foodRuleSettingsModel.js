// Model: Mum's rules that cover a kind of food (CB69-18): "No fried food", "No sugary drinks".
// Rows live in Leroy's child_food_rules table next to his per-dish locks (rule_type 'blocked_item'),
// so Raghav's menu already reads them through Teammates.getFoodRules.
const pool = require("../../config/db");

const RULE_TYPES = ["no_fried", "no_sugary"];

// -> Set of the rule types switched on for this kid
async function listForChild(childId) {
  const { rows } = await pool.query(
    `SELECT rule_type FROM child_food_rules WHERE child_id = $1 AND rule_type = ANY($2::text[])`,
    [childId, RULE_TYPES]
  );
  return new Set(rows.map((r) => r.rule_type));
}

async function turnOn(childId, ruleType) {
  await pool.query(
    `INSERT INTO child_food_rules (child_id, rule_type) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
    [childId, ruleType]
  );
}

async function turnOff(childId, ruleType) {
  await pool.query(`DELETE FROM child_food_rules WHERE child_id = $1 AND rule_type = $2`, [childId, ruleType]);
}

module.exports = { RULE_TYPES, listForChild, turnOn, turnOff };
