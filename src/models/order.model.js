const db = require('../utils/db.util');

async function createOrder(connection, payload) {
  const [result] = await connection.execute(
    `INSERT INTO orders (user_id, address_id, slot_id, phone, comment_text, subtotal, discount_total, total, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'new')`,
    [
      payload.user_id,
      payload.address_id,
      payload.slot_id,
      payload.phone,
      payload.comment_text || null,
      payload.subtotal,
      payload.discount_total,
      payload.total
    ]
  );
  return result.insertId;
}

async function createOrderItems(connection, orderId, items) {
  for (const item of items) {
    await connection.execute(
      `INSERT INTO order_items (
        order_id, product_id, unit_price, quantity,
        discount_percent_applied, discount_fixed_applied, final_unit_price, line_total
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        orderId,
        item.product_id,
        item.unit_price,
        item.quantity,
        item.discount_percent_applied,
        item.discount_fixed_applied,
        item.final_unit_price,
        item.line_total
      ]
    );
  }
}

async function createStatusHistory(connection, orderId, userId, status) {
  await connection.execute(
    `INSERT INTO order_status_history (order_id, status, changed_by) VALUES (?, ?, ?)`,
    [orderId, status, userId]
  );
}

async function registerPromoUsage(connection, { userId, promoCodeId, orderId, discountAmount }) {
  await connection.execute(
    `INSERT INTO user_promo_usages (user_id, promo_code_id, order_id) VALUES (?, ?, ?)`,
    [userId, promoCodeId, orderId]
  );

  await connection.execute(
    `INSERT INTO order_promo_codes (order_id, promo_code_id, discount_amount) VALUES (?, ?, ?)`,
    [orderId, promoCodeId, discountAmount]
  );
}

async function hasUserUsedPromo(userId, promoCodeId) {
  const rows = await db.query(
    `SELECT id FROM user_promo_usages WHERE user_id = ? AND promo_code_id = ? LIMIT 1`,
    [userId, promoCodeId]
  );
  return Boolean(rows[0]);
}

async function listCourierOrders(userId, roleCode) {
  if (roleCode === 'admin') {
    return db.query(
      `SELECT o.id, o.status, o.phone, o.total, o.created_at,
              o.courier_id, o.courier_confirmed_at, o.client_confirmed_at,
              u.full_name AS client_name,
              a.city, a.street, a.house,
              ds.label AS slot_label,
              cu.full_name AS courier_name
       FROM orders o
       JOIN users u ON u.id = o.user_id
       JOIN user_addresses a ON a.id = o.address_id
       JOIN delivery_slots ds ON ds.id = o.slot_id
       LEFT JOIN users cu ON cu.id = o.courier_id
       WHERE o.status IN ('confirmed', 'packing', 'delivery', 'new')
       ORDER BY o.id DESC`
    );
  }

  return db.query(
    `SELECT o.id, o.status, o.phone, o.total, o.created_at,
            o.courier_id, o.courier_confirmed_at, o.client_confirmed_at,
            u.full_name AS client_name,
            a.city, a.street, a.house,
            ds.label AS slot_label,
            cu.full_name AS courier_name
     FROM orders o
     JOIN users u ON u.id = o.user_id
     JOIN user_addresses a ON a.id = o.address_id
     JOIN delivery_slots ds ON ds.id = o.slot_id
     LEFT JOIN users cu ON cu.id = o.courier_id
    WHERE (o.courier_id IS NULL AND o.status IN ('new', 'confirmed', 'packing', 'delivery'))
       OR (o.courier_id = ? AND o.status IN ('new', 'confirmed', 'packing', 'delivery'))
     ORDER BY o.id DESC`,
    [userId]
  );
}

async function acceptOrderByCourier(orderId, courierUserId) {
  return db.withTransaction(async (connection) => {
    const [rows] = await connection.execute(
      `SELECT id, courier_id, status
       FROM orders
       WHERE id = ?
       LIMIT 1
       FOR UPDATE`,
      [orderId]
    );

    const order = rows[0];
    if (!order) throw new Error('Заказ не найден');
    if (order.courier_id && Number(order.courier_id) !== Number(courierUserId)) {
      throw new Error('Заказ уже закреплен за другим курьером');
    }
    if (order.status === 'canceled' || order.status === 'delivered') {
      throw new Error('Заказ уже закрыт');
    }

    await connection.execute(
      `UPDATE orders
       SET courier_id = ?, status = 'delivery', updated_at = NOW()
       WHERE id = ?`,
      [courierUserId, orderId]
    );

    await connection.execute(
      `INSERT INTO order_status_history (order_id, status, changed_by)
       VALUES (?, 'delivery', ?)`,
      [orderId, courierUserId]
    );
  });
}

async function courierConfirmDelivery(orderId, courierUserId) {
  return db.withTransaction(async (connection) => {
    const [rows] = await connection.execute(
      `SELECT id, courier_id, client_confirmed_at, status
       FROM orders
       WHERE id = ?
       LIMIT 1
       FOR UPDATE`,
      [orderId]
    );

    const order = rows[0];
    if (!order) throw new Error('Заказ не найден');
    if (Number(order.courier_id || 0) !== Number(courierUserId)) {
      throw new Error('Заказ не закреплен за этим курьером');
    }

    let finalStatus = 'delivery';
    let closedAtSql = '';
    if (order.client_confirmed_at) {
      finalStatus = 'delivered';
      closedAtSql = ', closed_at = NOW()';
    }

    await connection.execute(
      `UPDATE orders
       SET courier_confirmed_at = NOW(), status = ?${closedAtSql}, updated_at = NOW()
       WHERE id = ?`,
      [finalStatus, orderId]
    );

    if (finalStatus === 'delivered') {
      await connection.execute(
        `INSERT INTO order_status_history (order_id, status, changed_by)
         VALUES (?, 'delivered', ?)`,
        [orderId, courierUserId]
      );
    }
  });
}

async function listUserOrders(userId) {
  return db.query(
    `SELECT o.id, o.status, o.total, o.created_at,
            o.courier_confirmed_at, o.client_confirmed_at,
            ds.label AS slot_label,
            cu.full_name AS courier_name
     FROM orders o
     JOIN delivery_slots ds ON ds.id = o.slot_id
     LEFT JOIN users cu ON cu.id = o.courier_id
     WHERE o.user_id = ?
     ORDER BY o.id DESC`,
    [userId]
  );
}

async function clientConfirmDelivery(orderId, userId) {
  return db.withTransaction(async (connection) => {
    const [rows] = await connection.execute(
      `SELECT id, user_id, courier_confirmed_at, client_confirmed_at
       FROM orders
       WHERE id = ?
       LIMIT 1
       FOR UPDATE`,
      [orderId]
    );

    const order = rows[0];
    if (!order) throw new Error('Заказ не найден');
    if (Number(order.user_id) !== Number(userId)) {
      throw new Error('Нет доступа к этому заказу');
    }
    if (!order.courier_confirmed_at) {
      throw new Error('Курьер еще не подтвердил доставку');
    }
    if (order.client_confirmed_at) {
      return;
    }

    await connection.execute(
      `UPDATE orders
       SET client_confirmed_at = NOW(), status = 'delivered', closed_at = NOW(), updated_at = NOW()
       WHERE id = ?`,
      [orderId]
    );

    await connection.execute(
      `INSERT INTO order_status_history (order_id, status, changed_by)
       VALUES (?, 'delivered', ?)`,
      [orderId, userId]
    );
  });
}

async function getUserOrderDetails(orderId, userId, options = {}) {
  const ignoreUserScope = Boolean(options.ignoreUserScope);
  const whereSql = ignoreUserScope
    ? `WHERE o.id = ?`
    : `WHERE o.id = ? AND o.user_id = ?`;
  const params = ignoreUserScope ? [orderId] : [orderId, userId];

  const orders = await db.query(
    `SELECT o.id, o.status, o.phone, o.comment_text, o.subtotal, o.discount_total, o.total, o.created_at,
            o.courier_confirmed_at, o.client_confirmed_at, o.closed_at,
            ds.label AS slot_label,
            a.city, a.street, a.house, a.apartment, a.comment_text AS address_comment,
            cu.full_name AS courier_name
     FROM orders o
     LEFT JOIN delivery_slots ds ON ds.id = o.slot_id
     LEFT JOIN user_addresses a ON a.id = o.address_id
     LEFT JOIN users cu ON cu.id = o.courier_id
     ${whereSql}
     LIMIT 1`,
    params
  );

  const order = orders[0];
  if (!order) return null;

  const [items, promos, history] = await Promise.all([
    db.query(
      `SELECT oi.id, oi.product_id, oi.quantity, oi.unit_price, oi.final_unit_price, oi.line_total,
              oi.discount_percent_applied, oi.discount_fixed_applied,
              p.name AS product_name, p.slug AS product_slug, p.sku AS product_sku
       FROM order_items oi
       LEFT JOIN products p ON p.id = oi.product_id
       WHERE oi.order_id = ?
       ORDER BY oi.id ASC`,
      [orderId]
    ),
    db.query(
      `SELECT pc.code, opc.discount_amount
       FROM order_promo_codes opc
       JOIN promo_codes pc ON pc.id = opc.promo_code_id
       WHERE opc.order_id = ?
       ORDER BY opc.id ASC`,
      [orderId]
    ),
    db.query(
      `SELECT osh.status, osh.changed_at, u.full_name AS changed_by_name
       FROM order_status_history osh
       LEFT JOIN users u ON u.id = osh.changed_by
       WHERE osh.order_id = ?
       ORDER BY osh.id ASC`,
      [orderId]
    )
  ]);

  return {
    ...order,
    items,
    promos,
    history
  };
}

module.exports = {
  createOrder,
  createOrderItems,
  createStatusHistory,
  registerPromoUsage,
  hasUserUsedPromo,
  listCourierOrders,
  acceptOrderByCourier,
  courierConfirmDelivery,
  listUserOrders,
  clientConfirmDelivery,
  getUserOrderDetails
};
