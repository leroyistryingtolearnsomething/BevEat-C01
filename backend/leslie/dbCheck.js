// Quick check that backend/.env can reach the Supabase database.
// Run from backend/: node leslie/dbCheck.js
const db = require("../config/db");

(async () => {
  try {
    const stalls = await db.query("select name from stalls order by stall_id");
    console.log("Connected. Stalls:", stalls.rows.map((r) => r.name).join(", "));

    const counts = await db.query(
      `select (select count(*) from users)::int as users,
              (select count(*) from child_profiles)::int as kids,
              (select count(*) from menu_items)::int as menu_items,
              (select count(*) from orders)::int as orders`
    );
    console.log("Row counts:", counts.rows[0]);
  } catch (err) {
    console.error("Could not connect:", err.message);
    console.error("On NP Wi-Fi? Switch to a hotspot or home Wi-Fi.");
    process.exitCode = 1;
  } finally {
    await db.end();
  }
})();
