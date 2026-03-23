const cartModel = require('../models/cart.model');
const checkoutService = require('../services/checkout.service');

function getSessionPromoCodes(req) {
  const current = Array.isArray(req.session.cartPromoCodes) ? req.session.cartPromoCodes : [];
  const normalized = checkoutService.normalizePromoCodes(current);
  req.session.cartPromoCodes = normalized;
  return normalized;
}

async function cartPage(req, res, next) {
  try {
    const promoCodes = getSessionPromoCodes(req);
    const pricing = await checkoutService.buildCartPricingWithPromos(req.session.user.id, promoCodes);
    req.session.cartPromoCodes = pricing.promoCodes || [];

    return res.render('cart/index', {
      title: 'Корзина',
      ...pricing
    });
  } catch (error) {
    return next(error);
  }
}

async function addOrUpdateItem(req, res) {
  try {
    const productId = Number(req.body.product_id);
    const quantity = Number(req.body.quantity || 1);

    const result = await cartModel.upsertItem({
      userId: req.session.user.id,
      productId,
      quantity
    });

    const promoCodes = getSessionPromoCodes(req);
    const pricing = await checkoutService.buildCartPricingWithPromos(req.session.user.id, promoCodes);
    req.session.cartPromoCodes = pricing.promoCodes || [];
    return res.json({ ok: true, data: { ...result, pricing } });
  } catch (error) {
    return res.status(400).json({ ok: false, message: error.message || 'Не удалось обновить корзину' });
  }
}

async function removeItem(req, res) {
  try {
    const productId = Number(req.params.productId);
    await cartModel.removeItem({ userId: req.session.user.id, productId });
    const promoCodes = getSessionPromoCodes(req);
    const pricing = await checkoutService.buildCartPricingWithPromos(req.session.user.id, promoCodes);
    req.session.cartPromoCodes = pricing.promoCodes || [];
    return res.json({ ok: true, data: { pricing } });
  } catch (error) {
    return res.status(400).json({ ok: false, message: error.message || 'Не удалось удалить из корзины' });
  }
}

async function addPromoCode(req, res) {
  try {
    const code = String(req.body.code || '').trim();
    if (!code) {
      return res.status(400).json({ ok: false, message: 'Введите промокод' });
    }

    const current = getSessionPromoCodes(req);
    const normalizedCode = code.toUpperCase();
    if (current.includes(normalizedCode)) {
      return res.status(400).json({ ok: false, message: 'Промокод уже добавлен' });
    }
    const candidate = checkoutService.normalizePromoCodes([...current, normalizedCode]);
    const pricing = await checkoutService.buildCartPricingWithPromos(req.session.user.id, candidate);
    const rejected = (pricing.rejectedPromoCodes || []).find((x) => x.code === normalizedCode);
    if (rejected) {
      return res.status(400).json({ ok: false, message: rejected.reason });
    }

    req.session.cartPromoCodes = pricing.promoCodes || [];
    return res.json({ ok: true, data: { pricing } });
  } catch (error) {
    return res.status(400).json({ ok: false, message: error.message || 'Не удалось активировать промокод' });
  }
}

async function removePromoCode(req, res) {
  try {
    const code = String(req.params.code || '').trim().toUpperCase();
    const current = getSessionPromoCodes(req);
    const filtered = current.filter((x) => x !== code);

    req.session.cartPromoCodes = filtered;
    const pricing = await checkoutService.buildCartPricingWithPromos(req.session.user.id, filtered);
    req.session.cartPromoCodes = pricing.promoCodes || [];

    return res.json({ ok: true, data: { pricing } });
  } catch (error) {
    return res.status(400).json({ ok: false, message: error.message || 'Не удалось удалить промокод' });
  }
}

module.exports = {
  cartPage,
  addOrUpdateItem,
  removeItem,
  addPromoCode,
  removePromoCode
};
