// Model: pay for a tray from the wallet. One transaction: take the money, then one order per stall.
const pool = require("../../config/db");
const Money = require("../../xinsheng/services/moneyService");

const cents = (n) => Math.round(Number(n) * 100);

class NotEnoughMoney extends Error {
  constructor(shortBy) {
    super("Not enough food money");
    this.shortBy = shortBy;
  }
}

// tray = what priceTray returned (prices come from the database, never from the client).
// Returns { orders: [{ orderId, stallId, stallName, queueNumber, total }], total, walletBalance }.
// Throws NotEnoughMoney, or whatever failed (after ROLLBACK, so nothing is saved or charged).
async function placeOrders(childId, tray) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Two quick taps: the second checkout waits here, then sees the money the first one used
    await client.query("SELECT 1 FROM child_profiles WHERE child_id = $1 FOR UPDATE", [childId]);
    const money = await Money.getMoneyToday(childId);
    const canSpend = Math.min(cents(money.leftToday), cents(money.walletBalance));
    if (cents(tray.total) > canSpend) throw new NotEnoughMoney((cents(tray.total) - canSpend) / 100);

    // The wallet check is repeated in the UPDATE itself, so the balance can never go below zero
    const paid = await client.query(
      `UPDATE child_profiles SET wallet_balance = wallet_balance - $1
        WHERE child_id = $2 AND wallet_balance >= $1
        RETURNING wallet_balance`,
      [tray.total, childId]
    );
    if (paid.rowCount === 0) throw new NotEnoughMoney(0);

    const orders = [];
    for (const stall of tray.stalls) {
      // queue numbers restart each Singapore day, per stall; the lock stops two kids getting the same one
      await client.query("SELECT pg_advisory_xact_lock($1)", [stall.stallId]);
      const next = await client.query(
        `SELECT COALESCE(MAX(queue_number), 0) + 1 AS n FROM orders
          WHERE stall_id = $1
            AND placed_at >= date_trunc('day', now() AT TIME ZONE 'Asia/Singapore') AT TIME ZONE 'Asia/Singapore'`,
        [stall.stallId]
      );
      const order = await client.query(
        `INSERT INTO orders (child_id, stall_id, queue_number, total_amount)
         VALUES ($1, $2, $3, $4) RETURNING order_id, queue_number`,
        [childId, stall.stallId, next.rows[0].n, stall.subtotal]
      );
      const { order_id: orderId, queue_number: queueNumber } = order.rows[0];

      for (const line of stall.lines) {
        const m = line.macros;
        const item = await client.query(
          `INSERT INTO order_items (order_id, item_id, item_name, quantity, unit_price, calories, protein_g, carbs_g, fat_g)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING order_item_id`,
          [orderId, line.itemId, line.name, line.quantity, line.unitPrice, m.calories, m.proteinG, m.carbsG, m.fatG]
        );
        for (const a of line.addOns) {
          await client.query(
            `INSERT INTO order_item_add_ons (order_item_id, add_on_id, add_on_name, extra_price) VALUES ($1, $2, $3, $4)`,
            [item.rows[0].order_item_id, a.id, a.name, a.extraPrice]
          );
        }
      }
      orders.push({ orderId, stallId: stall.stallId, stallName: stall.stallName, queueNumber, total: stall.subtotal });
    }

    await client.query("COMMIT");
    return { orders, total: tray.total, walletBalance: Number(paid.rows[0].wallet_balance) };
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {}); // the original error matters more than a failed rollback
    throw err;
  } finally {
    client.release();
  }
}

module.exports = { placeOrders, NotEnoughMoney };
