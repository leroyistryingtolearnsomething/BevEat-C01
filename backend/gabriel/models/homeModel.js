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
module.exports = {getChildSummary, getSpentToday};