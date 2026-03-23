const checkoutService = require('../services/checkout.service');
const addressModel = require('../models/address.model');
const slotModel = require('../models/deliverySlot.model');

const FIXED_CITY = 'Казань';

function validRussianPhone(phone) {
  const text = String(phone || '').trim();
  const re = /^(\+7|8)\s?\(?\d{3}\)?[\s-]?\d{3}[\s-]?\d{2}[\s-]?\d{2}$/;
  return re.test(text);
}

function sanitizeForm(body) {
  return {
    phone: String(body.phone || '').trim(),
    city: FIXED_CITY,
    street: String(body.street || '').trim(),
    house: String(body.house || '').trim(),
    apartment: String(body.apartment || '').trim(),
    comment_text: String(body.comment_text || '').trim(),
    slot_id: String(body.slot_id || '').trim()
  };
}

async function checkoutPage(req, res, next) {
  try {
    const promoCodes = Array.isArray(req.session.cartPromoCodes) ? req.session.cartPromoCodes : [];
    const [pricing, slots] = await Promise.all([
      checkoutService.buildCartPricingWithPromos(req.session.user.id, promoCodes),
      slotModel.getActiveSlots()
    ]);

    return res.render('checkout/index', {
      title: 'Оформление заказа',
      ...pricing,
      slots,
      form: {
        phone: '',
        city: FIXED_CITY,
        street: '',
        house: '',
        apartment: '',
        comment_text: '',
        slot_id: slots[0] ? String(slots[0].id) : ''
      }
    });
  } catch (error) {
    return next(error);
  }
}

async function placeOrder(req, res, next) {
  try {
    const promoCodes = Array.isArray(req.session.cartPromoCodes) ? req.session.cartPromoCodes : [];
    const [pricing, slots] = await Promise.all([
      checkoutService.buildCartPricingWithPromos(req.session.user.id, promoCodes),
      slotModel.getActiveSlots()
    ]);

    const form = sanitizeForm(req.body);
    const errors = [];

    if (!validRussianPhone(form.phone)) {
      errors.push('Введите корректный российский номер телефона');
    }

    if (!form.city) {
      errors.push('Доставка возможна только по городу Казань');
    }

    if (!form.street || form.street.length < 2) errors.push('Укажите улицу');
    if (!form.house || !/\d/.test(form.house)) errors.push('Укажите дом');

    const slotIds = new Set(slots.map((s) => String(s.id)));
    if (!form.slot_id || !slotIds.has(form.slot_id)) {
      errors.push('Выберите удобное время доставки');
    }

    if (errors.length) {
      return res.status(400).render('checkout/index', {
        title: 'Оформление заказа',
        ...pricing,
        slots,
        errors,
        form
      });
    }

    const addressId = await addressModel.createAddress(req.session.user.id, {
      city: FIXED_CITY,
      street: form.street,
      house: form.house,
      apartment: form.apartment,
      comment_text: form.comment_text
    });

    const promoCodesInput = promoCodes.join(' ');

    const result = await checkoutService.placeOrder({
      userId: req.session.user.id,
      addressId,
      slotId: Number(form.slot_id),
      phone: form.phone,
      commentText: form.comment_text || '',
      promoCodesInput
    });

    req.session.cartPromoCodes = [];

    return res.render('checkout/success', {
      title: 'Заказ оформлен',
      order: result
    });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  checkoutPage,
  placeOrder
};
