const pool = require("../../config/db")

async function getMyDishes(childId) {
    const {rows} = await pool.query(
        `SELECT * FROM(
        SELECT DISTINCT ON (oi.item_id) oi.item_id, m.name,
         m.default_image_url, o.order_id, o.placed_at
        FROM orders o
        JOIN order_items oi ON oi.order_id = o.order_id
        JOIN menu_items m ON m.item_id = oi.item_id
        WHERE o.child_id = $1 AND o.status <> 'cancelled'
        ORDER BY oi.item_id, o.placed_at DESC) latest
        ORDER BY placed_at DESC
        LIMIT 10
        `, [childId]
    )
    return rows;
}

async function didOrder(childId, orderId, itemId) {
    const {rows} = await pool.query(
        `SELECT 1
        FROM orders o
        JOIN order_items oi ON oi.order_id = o.order_id
        WHERE o.order_id = $1 AND o.child_id = $2 AND oi.item_id = $3 AND o.status <> 'cancelled'`
        , [orderId, childId, itemId]
    )
    return rows.length > 0;
}

async function addPhoto(itemId, childId, orderId, imageUrl) {
    const {rows} = await pool.query(
        `INSERT INTO photos (item_id, uploaded_by, order_id, image_url, is_verified_diner, ai_status)
        VALUES ($1, $2, $3, $4, true, 'pending')
        RETURNING photo_id, image_url, ai_status` , [itemId, childId, orderId, imageUrl]
    )
    return rows[0];
}

module.exports = {getMyDishes, didOrder, addPhoto}