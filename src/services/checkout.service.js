const pool = require('../config/db');
const cartModel = require('../models/cart.model');
const discountModel = require('../models/discount.model');
const orderModel = require('../models/order.model');
const { applyDiscountsToProduct } = require('./discount.service');

function splitPromoCodes(input) {
  return String(input || '')
    .split(/[\s,;]+/)
    .map((v) => v.trim().toUpperCase())
    .filter(Boolean);
}

function normalizePromoCodes(input) {
  const codes = Array.isArray(input)
    ? splitPromoCodes(input.join(' '))
    : splitPromoCodes(input);
  return [...new Set(codes)];
}

function isItemScope(scope) {
  return ['product', 'category', 'list', 'catalog'].includes(scope);
}

async function resolvePromoRulesForUser(userId, promoCodesInput) {
  const codes = normalizePromoCodes(promoCodesInput);
  if (!codes.length) {
    return { validCodes: [], validRules: [], rejected: [] };
  }

  const promoRules = await discountModel.getPromoRulesByCodes(codes);
  const byCode = new Map();
  promoRules.forEach((rule) => {
    byCode.set(String(rule.code || '').toUpperCase(), rule);
  });

  const checks = await Promise.all(
    codes.map(async (code) => {
      const rule = byCode.get(code);
      if (!rule) {
        return { code, ok: false, reason: 'Промокод не найден или неактивен' };
      }
      const used = await orderModel.hasUserUsedPromo(userId, rule.promo_code_id);
      if (used) {
        return { code, ok: false, reason: 'Этот промокод уже использован' };
      }
      return { code, ok: true, rule };
    })
  );

  const validCodes = [];
  const validRules = [];
  const rejected = [];

  checks.forEach((result) => {
    if (result.ok) {
      validCodes.push(result.code);
      validRules.push(result.rule);
    } else {
      rejected.push({ code: result.code, reason: result.reason });
    }
  });

  return { validCodes, validRules, rejected };
}

async function buildCartPricing(userId, options = {}) {
  const promoRuleIds = Array.isArray(options.promoRuleIds) ? options.promoRuleIds : [];
  const cartItems = await cartModel.getDetailedCart(userId);
  if (!cartItems.length) {
    return { cartItems: [], subtotal: 0, total: 0, discountTotal: 0 };
  }

  const pricedItems = await Promise.all(
    cartItems.map(async (item) => {
      const discounts = await discountModel.getActiveDiscountsForProduct(
        item.product_id,
        item.category_id,
        { promoRuleIds }
      );
      const pricing = applyDiscountsToProduct({
        basePrice: item.price,
        maxDiscountPercent: item.max_discount_percent,
        discounts
      });

      return {
        ...item,
        discounts,
        unit_price: Number(item.price),
        final_unit_price: pricing.finalPrice,
        line_total: Number((pricing.finalPrice * item.quantity).toFixed(2)),
        item_discount_money: Number((pricing.saved * item.quantity).toFixed(2)),
        discount_percent_applied: pricing.finalDiscountPercent,
        discount_fixed_applied: 0,
        pricing
      };
    })
  );

  const subtotal = pricedItems.reduce((sum, item) => sum + item.unit_price * item.quantity, 0);
  const totalAfterItemDiscounts = pricedItems.reduce((sum, item) => sum + item.line_total, 0);
  const discountTotalItems = subtotal - totalAfterItemDiscounts;

  return {
    cartItems: pricedItems,
    subtotal: Number(subtotal.toFixed(2)),
    total: Number(totalAfterItemDiscounts.toFixed(2)),
    discountTotal: Number(discountTotalItems.toFixed(2))
  };
}

async function applyOrderAndPromoDiscounts(userId, pricing, promoCodesInput, options = {}) {
  const promoRules = Array.isArray(options.promoRules) ? options.promoRules : [];
  const promoOrderRuleIds = promoRules
    .filter((x) => x.scope === 'order_sum')
    .map((x) => Number(x.discount_rule_id));
  const orderRules = await discountModel.getOrderLevelDiscounts(pricing.total, {
    promoRuleIds: promoOrderRuleIds
  });

  const promoByRuleId = new Map();
  promoRules.forEach((rule) => {
    promoByRuleId.set(Number(rule.discount_rule_id), rule);
  });

  let total = pricing.total;
  const applied = [];
  const promoAmounts = new Map();

  for (const rule of orderRules) {
    const promoRule = promoByRuleId.get(Number(rule.id));
    if (rule.discount_type === 'percent') {
      const amount = total * (Number(rule.discount_value) / 100);
      total -= amount;
      const normalizedAmount = Number(amount.toFixed(2));
      if (promoRule) {
        applied.push({ source: 'promo', name: promoRule.code, amount: normalizedAmount });
        promoAmounts.set(
          Number(promoRule.promo_code_id),
          Number((Number(promoAmounts.get(Number(promoRule.promo_code_id)) || 0) + normalizedAmount).toFixed(2))
        );
      } else {
        applied.push({ source: 'order_sum', name: rule.name, amount: normalizedAmount });
      }
    } else {
      const amount = Number(rule.discount_value);
      total -= amount;
      const normalizedAmount = Number(amount.toFixed(2));
      if (promoRule) {
        applied.push({ source: 'promo', name: promoRule.code, amount: normalizedAmount });
        promoAmounts.set(
          Number(promoRule.promo_code_id),
          Number((Number(promoAmounts.get(Number(promoRule.promo_code_id)) || 0) + normalizedAmount).toFixed(2))
        );
      } else {
        applied.push({ source: 'order_sum', name: rule.name, amount: normalizedAmount });
      }
    }
  }

  for (const promo of promoRules) {
    if (isItemScope(promo.scope)) {
      applied.push({ source: 'promo_item', name: promo.code, amount: 0 });
    }
  }

  total = Math.max(total, 0);
  const discountTotal = Number((pricing.subtotal - total).toFixed(2));
  const promoApplications = promoRules.map((promo) => ({
    promo_code_id: promo.promo_code_id,
    code: promo.code,
    amount: Number(promoAmounts.get(Number(promo.promo_code_id)) || 0)
  }));

  return {
    total: Number(total.toFixed(2)),
    discountTotal,
    applied,
    promoApplications
  };
}

async function buildCartPricingWithPromos(userId, promoCodesInput) {
  const promoState = await resolvePromoRulesForUser(userId, promoCodesInput);
  const promoItemRuleIds = promoState.validRules
    .filter((x) => isItemScope(x.scope))
    .map((x) => Number(x.discount_rule_id));

  const pricing = await buildCartPricing(userId, { promoRuleIds: promoItemRuleIds });
  const extra = await applyOrderAndPromoDiscounts(userId, pricing, '', {
    promoRules: promoState.validRules
  });

  return {
    ...pricing,
    total: extra.total,
    discountTotal: extra.discountTotal,
    appliedDiscounts: extra.applied,
    promoApplications: extra.promoApplications,
    promoCodes: promoState.validCodes,
    rejectedPromoCodes: promoState.rejected
  };
}

async function placeOrder({ userId, addressId, slotId, phone, commentText, promoCodesInput }) {
  const pricing = await buildCartPricingWithPromos(userId, promoCodesInput);
  if (!pricing.cartItems.length) {
    throw new Error('Корзина пуста');
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const cartId = pricing.cartItems[0].cart_id;

    for (const item of pricing.cartItems) {
      const [stockRows] = await connection.execute(
        `SELECT stock_quantity FROM products WHERE id = ? FOR UPDATE`,
        [item.product_id]
      );

      const currentStock = Number(stockRows[0]?.stock_quantity || 0);
      if (currentStock < item.quantity) {
        throw new Error(`Недостаточно товара на складе: ${item.name}`);
      }

      await connection.execute(
        `UPDATE products SET stock_quantity = stock_quantity - ? WHERE id = ?`,
        [item.quantity, item.product_id]
      );

      await connection.execute(
        `INSERT INTO inventory_movements (product_id, movement_type, quantity, reason_text, created_by)
         VALUES (?, 'out', ?, 'order checkout', ?)`,
        [item.product_id, item.quantity, userId]
      );
    }

    const orderId = await orderModel.createOrder(connection, {
      user_id: userId,
      address_id: addressId,
      slot_id: slotId,
      phone,
      comment_text: commentText,
      subtotal: pricing.subtotal,
      discount_total: pricing.discountTotal,
      total: pricing.total
    });

    const orderItems = pricing.cartItems.map((item) => ({
      product_id: item.product_id,
      unit_price: item.unit_price,
      quantity: item.quantity,
      discount_percent_applied: item.discount_percent_applied,
      discount_fixed_applied: item.discount_fixed_applied,
      final_unit_price: item.final_unit_price,
      line_total: item.line_total
    }));

    await orderModel.createOrderItems(connection, orderId, orderItems);
    await orderModel.createStatusHistory(connection, orderId, userId, 'new');

    for (const promo of pricing.promoApplications) {
      await orderModel.registerPromoUsage(connection, {
        userId,
        promoCodeId: promo.promo_code_id,
        orderId,
        discountAmount: promo.amount
      });
    }

    await cartModel.markCartAsOrdered(cartId, connection);

    await connection.commit();

    return {
      orderId,
      subtotal: pricing.subtotal,
      total: pricing.total,
      discountTotal: pricing.discountTotal,
      appliedDiscounts: pricing.appliedDiscounts
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

module.exports = {
  splitPromoCodes,
  normalizePromoCodes,
  buildCartPricing,
  buildCartPricingWithPromos,
  applyOrderAndPromoDiscounts,
  resolvePromoRulesForUser,
  placeOrder
};
