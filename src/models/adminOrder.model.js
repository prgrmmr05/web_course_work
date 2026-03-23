const db = require('../utils/db.util');

async function listCouriers() {
  return db.query(
    `SELECT u.id, u.full_name, u.email
     FROM users u
     JOIN roles r ON r.id = u.role_id
     WHERE r.code = 'courier' AND u.is_active = 1
     ORDER BY u.full_name ASC`
  );
}

async function listOrders(search = '', status = '') {
  const q = `%${search}%`;
  return db.query(
    `SELECT o.id, o.status, o.subtotal, o.discount_total, o.total, o.phone, o.created_at,
            o.courier_id, o.courier_confirmed_at, o.client_confirmed_at,
            u.full_name AS user_name, u.email AS user_email,
            a.city, a.street, a.house,
            ds.label AS slot_label,
            cu.full_name AS courier_name
     FROM orders o
     JOIN users u ON u.id = o.user_id
     JOIN user_addresses a ON a.id = o.address_id
     JOIN delivery_slots ds ON ds.id = o.slot_id
     LEFT JOIN users cu ON cu.id = o.courier_id
     WHERE (? = '%%' OR u.full_name LIKE ? OR u.email LIKE ? OR o.phone LIKE ? OR CAST(o.id AS CHAR) LIKE ?)
       AND (? = '' OR o.status = ?)
     ORDER BY o.id DESC`,
    [q, q, q, q, q, status, status]
  );
}

async function listOrdersForDispatch(search = '') {
  const q = `%${search}%`;
  return db.query(
    `SELECT o.id, o.status, o.phone, o.created_at,
            o.courier_id, o.courier_confirmed_at, o.client_confirmed_at,
            u.full_name AS user_name, u.email AS user_email,
            a.city, a.street, a.house,
            ds.label AS slot_label,
            cu.full_name AS courier_name
     FROM orders o
     JOIN users u ON u.id = o.user_id
     JOIN user_addresses a ON a.id = o.address_id
     JOIN delivery_slots ds ON ds.id = o.slot_id
     LEFT JOIN users cu ON cu.id = o.courier_id
     WHERE o.status IN ('new', 'confirmed', 'packing', 'delivery')
       AND (? = '%%' OR u.full_name LIKE ? OR u.email LIKE ? OR o.phone LIKE ? OR CAST(o.id AS CHAR) LIKE ?)
     ORDER BY o.id DESC`,
    [q, q, q, q, q]
  );
}

async function getOrderById(id) {
  const rows = await db.query(
    `SELECT o.id, o.user_id, o.address_id, o.slot_id, o.status, o.phone, o.comment_text,
            o.courier_id, o.courier_confirmed_at, o.client_confirmed_at,
            o.subtotal, o.discount_total, o.total, o.created_at,
            u.full_name AS user_name, u.email AS user_email,
            a.city, a.street, a.house, a.apartment, a.comment_text AS address_comment,
            ds.label AS slot_label,
            cu.full_name AS courier_name
     FROM orders o
     JOIN users u ON u.id = o.user_id
     JOIN user_addresses a ON a.id = o.address_id
     JOIN delivery_slots ds ON ds.id = o.slot_id
     LEFT JOIN users cu ON cu.id = o.courier_id
     WHERE o.id = ?
     LIMIT 1`,
    [id]
  );
  return rows[0] || null;
}

async function getOrderItems(orderId) {
  return db.query(
    `SELECT oi.id, oi.product_id, oi.quantity, oi.unit_price, oi.final_unit_price, oi.line_total,
            p.name AS product_name, p.sku
     FROM order_items oi
     JOIN products p ON p.id = oi.product_id
     WHERE oi.order_id = ?
     ORDER BY oi.id ASC`,
    [orderId]
  );
}

async function updateOrder(id, payload) {
  return db.withTransaction(async (connection) => {
    const [rows] = await connection.execute(
      `SELECT status FROM orders WHERE id = ? LIMIT 1`,
      [id]
    );
    const existing = rows[0];
    if (!existing) return false;

    await connection.execute(
      `UPDATE orders
       SET status = ?, phone = ?, comment_text = ?, courier_id = ?, updated_at = NOW()
       WHERE id = ?`,
      [
        payload.status,
        payload.phone,
        payload.comment_text || null,
        payload.courier_id || null,
        id
      ]
    );

    if (existing.status !== payload.status) {
      await connection.execute(
        `INSERT INTO order_status_history (order_id, status, changed_by)
         VALUES (?, ?, ?)`,
        [id, payload.status, payload.changed_by || null]
      );
    }

    return true;
  });
}

async function assignCourierToOrder(id, courierId, changedBy) {
  return db.withTransaction(async (connection) => {
    const [rows] = await connection.execute(
      `SELECT status, courier_id
       FROM orders
       WHERE id = ?
       LIMIT 1`,
      [id]
    );
    const existing = rows[0];
    if (!existing) return { ok: false, reason: 'not_found' };
    if (existing.status === 'delivered' || existing.status === 'canceled') {
      return { ok: false, reason: 'closed' };
    }

    const incomingCourierId = courierId || null;
    let nextStatus = existing.status;
    if (incomingCourierId && ['new', 'confirmed', 'packing'].includes(existing.status)) {
      nextStatus = 'delivery';
    }

    await connection.execute(
      `UPDATE orders
       SET courier_id = ?, status = ?, updated_at = NOW()
       WHERE id = ?`,
      [incomingCourierId, nextStatus, id]
    );

    const courierChanged = Number(existing.courier_id || 0) !== Number(incomingCourierId || 0);
    if (courierChanged || existing.status !== nextStatus) {
      await connection.execute(
        `INSERT INTO order_status_history (order_id, status, changed_by)
         VALUES (?, ?, ?)`,
        [id, nextStatus, changedBy || null]
      );
    }

    return { ok: true, status: nextStatus };
  });
}

module.exports = {
  listCouriers,
  listOrders,
  listOrdersForDispatch,
  getOrderById,
  getOrderItems,
  updateOrder,
  assignCourierToOrder
};
