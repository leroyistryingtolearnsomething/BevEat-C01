const pool = require("../../config/db");

async function getChildSummary(childId)
{
    const {rows} = await pool.query(
        `SELECT u.display_name, u.avatar_emoji, c.wallet_balance, c.daily_limit
        FROM users u
        JOIN child_profiles c ON c.child_id = u.user_id
        WHERE u.user_id = $1`,
        [childId]
    );// returns object (rows) is an array with one object per result row

        // the name is stored in the users table and the money is stored in the child profile table
        // both tables use the same id so JOIN merges the 2 tables into 1
        //$1 and [childId]: $1 is filled in with the first value in the array - paramenterized query
    return rows[0]; // returns one child only
    // childId comes from the login jwt token
}

async function getSpentToday(childId){
    const {rows} = await pool.query
    (
         `SELECT COALESCE(SUM(total_amount), 0) AS spent 
         FROM orders 
         WHERE child_id = $1 AND status <> 'cancelled'
         AND placed_at >= date_trunc('day', now() AT TIME ZONE 'Asia/Singapore') AT TIME ZONE
         'Asia/Singapore'`,
        [childId]
    );
    return rows[0].spent;
}

async function getRules(childId) {
    const {rows} = await pool.query
    (
        `SELECT name, icon, severity FROM (
            SELECT a.name, a.icon, ca.severity, 0 AS custom
            FROM child_allergies ca
            JOIN allergens a ON a.allergen_id = ca.allergen_id
            WHERE ca.child_id = $1
            UNION ALL
            -- allergies the parent typed in themselves (Leslie, migration 005)
            SELECT cc.label, cc.icon, 'avoid', 1
            FROM child_custom_allergies cc
            WHERE cc.child_id = $1) r
        ORDER BY custom, name`, [childId]
    );
    return rows; // to return all the allergies from the whole array
}

async function getTopPics(childId) {
    const {rows} = await pool.query
    (
        `SELECT * FROM(
            SELECT DISTINCT ON (m.item_id)
        p.photo_id, m.item_id, m.name, m.price, p.image_url,
        COUNT(v.user_id) AS likes,
        m.item_id IN (
        SELECT b.item_id
        FROM v_child_blocked_items b -- preset + custom allergies (migration 005)
        WHERE b.child_id = $1)
        AS blocked
        FROM photos p
        JOIN menu_items m ON m.item_id = p.item_id
        LEFT JOIN photo_votes v ON v.photo_id = p.photo_id
        WHERE p.ai_status = 'passed'
        AND p.approval_status IN ('approved', 'not_needed')
        GROUP BY p.photo_id, m.item_id
        ORDER BY m.item_id, likes DESC, p.uploaded_at DESC) best
        ORDER BY likes DESC
        LIMIT 10`, [childId]
    );
    return rows;    
}

async function getStalls(childId) {
    const {rows} = await pool.query
    (
        `SELECT s.stall_id, s.name, s.unit_no, s.cover_image_url,
         COUNT(m.item_id) FILTER (WHERE m.item_id NOT IN (
         SELECT b.item_id
            FROM v_child_blocked_items b -- preset + custom allergies (migration 005)
                WHERE b.child_id = $1)) AS safe_picks
            FROM stalls s
            LEFT JOIN menu_items m ON m.stall_id = s.stall_id AND
            m.is_available
            WHERE s.is_open
            GROUP BY s.stall_id
            ORDER BY s.name`, [childId]
    );

    return rows;
}
module.exports = {getChildSummary, getSpentToday, getRules, getStalls, getTopPics};