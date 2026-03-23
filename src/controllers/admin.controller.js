const bcrypt = require('bcrypt');
const categoryModel = require('../models/adminCategory.model');
const productModel = require('../models/adminProduct.model');
const discountModel = require('../models/adminDiscount.model');
const adminReviewModel = require('../models/adminReview.model');
const adminOrderModel = require('../models/adminOrder.model');
const adminUserModel = require('../models/adminUser.model');
const catalogCategoryModel = require('../models/category.model');
const { normalizeBool, slugify } = require('../utils/admin.util');

function renderAdmin(res, view, data) {
  return res.render(view, {
    title: 'Админ-панель',
    ...data
  });
}

async function dashboard(req, res) {
  return renderAdmin(res, 'admin/dashboard', {});
}

async function categoriesList(req, res, next) {
  try {
    const search = (req.query.search || '').trim();
    const items = await categoryModel.listCategories(search);
    return renderAdmin(res, 'admin/categories/list', { items, search });
  } catch (error) { return next(error); }
}

async function categoryNewForm(req, res) {
  return renderAdmin(res, 'admin/categories/form', { item: {}, action: '/admin/categories' });
}

async function categoryCreate(req, res, next) {
  try {
    await categoryModel.createCategory({
      name: (req.body.name || '').trim(),
      slug: (req.body.slug || '').trim() || slugify(req.body.name),
      is_active: normalizeBool(req.body.is_active)
    });
    return res.redirect('/admin/categories');
  } catch (error) { return next(error); }
}

async function categoryEditForm(req, res, next) {
  try {
    const item = await categoryModel.getCategoryById(Number(req.params.id));
    if (!item) return res.redirect('/admin/categories');
    return renderAdmin(res, 'admin/categories/form', { item, action: `/admin/categories/${item.id}` });
  } catch (error) { return next(error); }
}

async function categoryUpdate(req, res, next) {
  try {
    await categoryModel.updateCategory(Number(req.params.id), {
      name: (req.body.name || '').trim(),
      slug: (req.body.slug || '').trim() || slugify(req.body.name),
      is_active: normalizeBool(req.body.is_active)
    });
    return res.redirect('/admin/categories');
  } catch (error) { return next(error); }
}

async function categoryDelete(req, res, next) {
  try {
    await categoryModel.deleteCategory(Number(req.params.id));
    return res.redirect('/admin/categories');
  } catch (error) { return next(error); }
}

async function productsList(req, res, next) {
  try {
    const search = (req.query.search || '').trim();
    const items = await productModel.listProducts(search);
    return renderAdmin(res, 'admin/products/list', { items, search });
  } catch (error) { return next(error); }
}

async function productNewForm(req, res, next) {
  try {
    const categories = await catalogCategoryModel.getAll();
    return renderAdmin(res, 'admin/products/form', { item: {}, categories, action: '/admin/products' });
  } catch (error) { return next(error); }
}

async function productCreate(req, res, next) {
  try {
    await productModel.createProduct({
      category_id: Number(req.body.category_id),
      name: (req.body.name || '').trim(),
      slug: (req.body.slug || '').trim() || slugify(req.body.name),
      description: (req.body.description || '').trim(),
      sku: (req.body.sku || '').trim(),
      price: Number(req.body.price || 0),
      max_discount_percent: Number(req.body.max_discount_percent || 40),
      stock_quantity: Number(req.body.stock_quantity || 0),
      is_active: normalizeBool(req.body.is_active)
    });
    return res.redirect('/admin/products');
  } catch (error) { return next(error); }
}

async function productEditForm(req, res, next) {
  try {
    const [item, categories] = await Promise.all([
      productModel.getProductById(Number(req.params.id)),
      catalogCategoryModel.getAll()
    ]);
    if (!item) return res.redirect('/admin/products');
    return renderAdmin(res, 'admin/products/form', { item, categories, action: `/admin/products/${item.id}` });
  } catch (error) { return next(error); }
}

async function productUpdate(req, res, next) {
  try {
    await productModel.updateProduct(Number(req.params.id), {
      category_id: Number(req.body.category_id),
      name: (req.body.name || '').trim(),
      slug: (req.body.slug || '').trim() || slugify(req.body.name),
      description: (req.body.description || '').trim(),
      sku: (req.body.sku || '').trim(),
      price: Number(req.body.price || 0),
      max_discount_percent: Number(req.body.max_discount_percent || 40),
      stock_quantity: Number(req.body.stock_quantity || 0),
      is_active: normalizeBool(req.body.is_active)
    });
    return res.redirect('/admin/products');
  } catch (error) { return next(error); }
}

async function productDelete(req, res, next) {
  try {
    await productModel.deleteProduct(Number(req.params.id));
    return res.redirect('/admin/products');
  } catch (error) { return next(error); }
}

async function discountsList(req, res, next) {
  try {
    const search = (req.query.search || '').trim();
    const items = await discountModel.listDiscounts(search);
    return renderAdmin(res, 'admin/discounts/list', { items, search });
  } catch (error) { return next(error); }
}

async function discountNewForm(req, res, next) {
  try {
    const [categories, products] = await Promise.all([
      catalogCategoryModel.getAll(),
      productModel.listProducts('')
    ]);

    return renderAdmin(res, 'admin/discounts/form', {
      item: {},
      target: { product_ids: [], category_ids: [], is_catalog: false },
      categories,
      products,
      action: '/admin/discounts'
    });
  } catch (error) { return next(error); }
}

async function discountCreate(req, res, next) {
  try {
    await discountModel.createDiscount({
      name: (req.body.name || '').trim(),
      description_text: (req.body.description_text || '').trim(),
      scope: req.body.scope,
      discount_type: req.body.discount_type,
      discount_value: Number(req.body.discount_value || 0),
      stackable: normalizeBool(req.body.stackable),
      min_order_amount: req.body.min_order_amount,
      max_order_amount: req.body.max_order_amount,
      start_at: req.body.start_at,
      end_at: req.body.end_at,
      is_active: normalizeBool(req.body.is_active),
      product_ids: req.body.product_ids,
      category_ids: req.body.category_ids,
      is_promo: normalizeBool(req.body.is_promo),
      promo_code: String(req.body.promo_code || '').trim().toUpperCase()
    });
    return res.redirect('/admin/discounts');
  } catch (error) {
    try {
      const [categories, products] = await Promise.all([
        catalogCategoryModel.getAll(),
        productModel.listProducts('')
      ]);

      return renderAdmin(res, 'admin/discounts/form', {
        item: {
          ...req.body,
          is_promo: normalizeBool(req.body.is_promo),
          stackable: normalizeBool(req.body.stackable),
          is_active: normalizeBool(req.body.is_active)
        },
        target: {
          product_ids: Array.isArray(req.body.product_ids) ? req.body.product_ids : (req.body.product_ids ? [req.body.product_ids] : []),
          category_ids: Array.isArray(req.body.category_ids) ? req.body.category_ids : (req.body.category_ids ? [req.body.category_ids] : []),
          is_catalog: req.body.scope === 'catalog'
        },
        categories,
        products,
        action: '/admin/discounts',
        errors: [error.message || 'Не удалось сохранить скидку']
      });
    } catch (renderError) {
      return next(renderError);
    }
  }
}

async function discountEditForm(req, res, next) {
  try {
    const discountId = Number(req.params.id);
    const [item, target, categories, products] = await Promise.all([
      discountModel.getDiscountById(discountId),
      discountModel.getDiscountTargets(discountId),
      catalogCategoryModel.getAll(),
      productModel.listProducts('')
    ]);

    if (!item) return res.redirect('/admin/discounts');

    return renderAdmin(res, 'admin/discounts/form', {
      item,
      target,
      categories,
      products,
      action: `/admin/discounts/${item.id}`
    });
  } catch (error) { return next(error); }
}

async function discountUpdate(req, res, next) {
  try {
    await discountModel.updateDiscount(Number(req.params.id), {
      name: (req.body.name || '').trim(),
      description_text: (req.body.description_text || '').trim(),
      scope: req.body.scope,
      discount_type: req.body.discount_type,
      discount_value: Number(req.body.discount_value || 0),
      stackable: normalizeBool(req.body.stackable),
      min_order_amount: req.body.min_order_amount,
      max_order_amount: req.body.max_order_amount,
      start_at: req.body.start_at,
      end_at: req.body.end_at,
      is_active: normalizeBool(req.body.is_active),
      product_ids: req.body.product_ids,
      category_ids: req.body.category_ids,
      is_promo: normalizeBool(req.body.is_promo),
      promo_code: String(req.body.promo_code || '').trim().toUpperCase()
    });
    return res.redirect('/admin/discounts');
  } catch (error) {
    try {
      const discountId = Number(req.params.id);
      const [categories, products] = await Promise.all([
        catalogCategoryModel.getAll(),
        productModel.listProducts('')
      ]);

      return renderAdmin(res, 'admin/discounts/form', {
        item: {
          id: discountId,
          ...req.body,
          is_promo: normalizeBool(req.body.is_promo),
          stackable: normalizeBool(req.body.stackable),
          is_active: normalizeBool(req.body.is_active)
        },
        target: {
          product_ids: Array.isArray(req.body.product_ids) ? req.body.product_ids : (req.body.product_ids ? [req.body.product_ids] : []),
          category_ids: Array.isArray(req.body.category_ids) ? req.body.category_ids : (req.body.category_ids ? [req.body.category_ids] : []),
          is_catalog: req.body.scope === 'catalog'
        },
        categories,
        products,
        action: `/admin/discounts/${discountId}`,
        errors: [error.message || 'Не удалось сохранить скидку']
      });
    } catch (renderError) {
      return next(renderError);
    }
  }
}

async function discountDelete(req, res, next) {
  try {
    await discountModel.deleteDiscount(Number(req.params.id));
    return res.redirect('/admin/discounts');
  } catch (error) { return next(error); }
}

async function productReviewsList(req, res, next) {
  try {
    const search = (req.query.search || '').trim();
    const items = await adminReviewModel.listProductReviews(search);
    return renderAdmin(res, 'admin/reviews/products', { items, search });
  } catch (error) { return next(error); }
}

async function storeReviewsList(req, res, next) {
  try {
    const search = (req.query.search || '').trim();
    const items = await adminReviewModel.listStoreReviews(search);
    return renderAdmin(res, 'admin/reviews/store', { items, search });
  } catch (error) { return next(error); }
}

async function productReviewToggle(req, res, next) {
  try {
    await adminReviewModel.setProductReviewPublished(Number(req.params.id), normalizeBool(req.body.is_published));
    return res.redirect('/admin/reviews/products');
  } catch (error) { return next(error); }
}

async function storeReviewToggle(req, res, next) {
  try {
    await adminReviewModel.setStoreReviewPublished(Number(req.params.id), normalizeBool(req.body.is_published));
    return res.redirect('/admin/reviews/store');
  } catch (error) { return next(error); }
}

async function productReviewNewForm(req, res, next) {
  try {
    const [clients, products] = await Promise.all([
      adminReviewModel.listClients(),
      adminReviewModel.listProducts()
    ]);
    return renderAdmin(res, 'admin/reviews/product-form', {
      item: {},
      clients,
      products,
      action: '/admin/reviews/products'
    });
  } catch (error) { return next(error); }
}

async function productReviewCreate(req, res, next) {
  try {
    await adminReviewModel.createProductReview({
      user_id: Number(req.body.user_id),
      product_id: Number(req.body.product_id),
      rating: Number(req.body.rating),
      comment_text: String(req.body.comment_text || '').trim(),
      is_published: normalizeBool(req.body.is_published)
    });
    return res.redirect('/admin/reviews/products');
  } catch (error) { return next(error); }
}

async function productReviewEditForm(req, res, next) {
  try {
    const [item, clients, products] = await Promise.all([
      adminReviewModel.getProductReviewById(Number(req.params.id)),
      adminReviewModel.listClients(),
      adminReviewModel.listProducts()
    ]);
    if (!item) return res.redirect('/admin/reviews/products');
    return renderAdmin(res, 'admin/reviews/product-form', {
      item,
      clients,
      products,
      action: `/admin/reviews/products/${item.id}`
    });
  } catch (error) { return next(error); }
}

async function productReviewUpdate(req, res, next) {
  try {
    await adminReviewModel.updateProductReview(Number(req.params.id), {
      user_id: Number(req.body.user_id),
      product_id: Number(req.body.product_id),
      rating: Number(req.body.rating),
      comment_text: String(req.body.comment_text || '').trim(),
      is_published: normalizeBool(req.body.is_published)
    });
    return res.redirect('/admin/reviews/products');
  } catch (error) { return next(error); }
}

async function productReviewDelete(req, res, next) {
  try {
    await adminReviewModel.deleteProductReview(Number(req.params.id));
    return res.redirect('/admin/reviews/products');
  } catch (error) { return next(error); }
}

async function storeReviewNewForm(req, res, next) {
  try {
    const clients = await adminReviewModel.listClients();
    return renderAdmin(res, 'admin/reviews/store-form', {
      item: {},
      clients,
      action: '/admin/reviews/store'
    });
  } catch (error) { return next(error); }
}

async function storeReviewCreate(req, res, next) {
  try {
    await adminReviewModel.createStoreReview({
      user_id: Number(req.body.user_id),
      rating: Number(req.body.rating),
      comment_text: String(req.body.comment_text || '').trim(),
      is_published: normalizeBool(req.body.is_published)
    });
    return res.redirect('/admin/reviews/store');
  } catch (error) { return next(error); }
}

async function storeReviewEditForm(req, res, next) {
  try {
    const [item, clients] = await Promise.all([
      adminReviewModel.getStoreReviewById(Number(req.params.id)),
      adminReviewModel.listClients()
    ]);
    if (!item) return res.redirect('/admin/reviews/store');
    return renderAdmin(res, 'admin/reviews/store-form', {
      item,
      clients,
      action: `/admin/reviews/store/${item.id}`
    });
  } catch (error) { return next(error); }
}

async function storeReviewUpdate(req, res, next) {
  try {
    await adminReviewModel.updateStoreReview(Number(req.params.id), {
      user_id: Number(req.body.user_id),
      rating: Number(req.body.rating),
      comment_text: String(req.body.comment_text || '').trim(),
      is_published: normalizeBool(req.body.is_published)
    });
    return res.redirect('/admin/reviews/store');
  } catch (error) { return next(error); }
}

async function storeReviewDelete(req, res, next) {
  try {
    await adminReviewModel.deleteStoreReview(Number(req.params.id));
    return res.redirect('/admin/reviews/store');
  } catch (error) { return next(error); }
}

async function ordersList(req, res, next) {
  try {
    const search = (req.query.search || '').trim();
    const status = (req.query.status || '').trim();
    const items = await adminOrderModel.listOrders(search, status);
    return renderAdmin(res, 'admin/orders/list', { items, search, status });
  } catch (error) { return next(error); }
}

async function orderEditForm(req, res, next) {
  try {
    const orderId = Number(req.params.id);
    const [item, orderItems, couriers] = await Promise.all([
      adminOrderModel.getOrderById(orderId),
      adminOrderModel.getOrderItems(orderId),
      adminOrderModel.listCouriers()
    ]);
    if (!item) return res.redirect('/admin/orders');
    return renderAdmin(res, 'admin/orders/form', {
      item,
      orderItems,
      couriers,
      action: `/admin/orders/${item.id}`
    });
  } catch (error) { return next(error); }
}

async function orderUpdate(req, res, next) {
  try {
    const ok = await adminOrderModel.updateOrder(Number(req.params.id), {
      status: String(req.body.status || 'new'),
      phone: String(req.body.phone || '').trim(),
      comment_text: String(req.body.comment_text || '').trim(),
      courier_id: Number(req.body.courier_id || 0) || null,
      changed_by: req.session.user?.id || null
    });
    if (!ok) return res.redirect('/admin/orders');
    return res.redirect('/admin/orders');
  } catch (error) { return next(error); }
}

async function dispatchList(req, res, next) {
  try {
    const search = (req.query.search || '').trim();
    const [items, couriers] = await Promise.all([
      adminOrderModel.listOrdersForDispatch(search),
      adminOrderModel.listCouriers()
    ]);
    return renderAdmin(res, 'admin/dispatch/list', { items, couriers, search });
  } catch (error) { return next(error); }
}

async function dispatchAssign(req, res, next) {
  try {
    const orderId = Number(req.params.id);
    const courierId = Number(req.body.courier_id || 0) || null;
    await adminOrderModel.assignCourierToOrder(orderId, courierId, req.session.user?.id || null);
    return res.redirect('/admin/dispatch');
  } catch (error) { return next(error); }
}

async function usersList(req, res, next) {
  try {
    const search = (req.query.search || '').trim();
    const role = (req.query.role || '').trim();
    const [items, roles] = await Promise.all([
      adminUserModel.listUsers(search, role),
      adminUserModel.listRoles()
    ]);
    return renderAdmin(res, 'admin/users/list', { items, search, role, roles });
  } catch (error) { return next(error); }
}

async function userNewForm(req, res, next) {
  try {
    const roles = await adminUserModel.listRoles();
    return renderAdmin(res, 'admin/users/form', {
      item: { is_active: 1, role_code: 'client', can_review_product: 1, can_review_store: 1 },
      roles,
      action: '/admin/users',
      isCreate: true
    });
  } catch (error) { return next(error); }
}

function validateUserPayload(body, isCreate = false) {
  const errors = [];
  const fullName = String(body.full_name || '').trim();
  const email = String(body.email || '').trim().toLowerCase();
  const phone = String(body.phone || '').trim();
  const roleCode = String(body.role_code || '').trim();
  const password = String(body.password || '');
  const canReviewProduct = normalizeBool(body.can_review_product);
  const canReviewStore = normalizeBool(body.can_review_store);

  if (fullName.length < 2) errors.push('Имя должно быть не короче 2 символов');
  if (!/^\S+@\S+\.\S+$/.test(email)) errors.push('Некорректный email');
  if (!/^\+?[0-9\-\s()]{10,20}$/.test(phone)) errors.push('Некорректный телефон');
  if (!roleCode) errors.push('Укажите роль');
  if (isCreate && password.length < 6) errors.push('Пароль должен быть не короче 6 символов');

  return {
    errors,
    payload: {
      fullName,
      email,
      phone,
      roleCode,
      password,
      canReviewProduct,
      canReviewStore
    }
  };
}

async function userCreate(req, res, next) {
  try {
    const roles = await adminUserModel.listRoles();
    const { errors, payload } = validateUserPayload(req.body, true);
    const roleId = await adminUserModel.getRoleIdByCode(payload.roleCode);
    if (!roleId) errors.push('Роль не найдена');

    const emailUsed = await adminUserModel.emailExists(payload.email);
    if (emailUsed) errors.push('Пользователь с таким email уже существует');

    if (errors.length) {
      return renderAdmin(res, 'admin/users/form', {
        item: {
          full_name: payload.fullName,
          email: payload.email,
          phone: payload.phone,
          role_code: payload.roleCode,
          is_active: normalizeBool(req.body.is_active),
          can_review_product: payload.canReviewProduct,
          can_review_store: payload.canReviewStore
        },
        roles,
        action: '/admin/users',
        isCreate: true,
        errors
      });
    }

    const passwordHash = await bcrypt.hash(payload.password, 10);
    await adminUserModel.createUser({
      role_id: roleId,
      full_name: payload.fullName,
      email: payload.email,
        phone: payload.phone,
        password_hash: passwordHash,
        is_active: normalizeBool(req.body.is_active),
        can_review_product: payload.canReviewProduct,
        can_review_store: payload.canReviewStore
      });

    return res.redirect('/admin/users');
  } catch (error) { return next(error); }
}

async function userEditForm(req, res, next) {
  try {
    const [item, roles] = await Promise.all([
      adminUserModel.getUserById(Number(req.params.id)),
      adminUserModel.listRoles()
    ]);
    if (!item) return res.redirect('/admin/users');
    return renderAdmin(res, 'admin/users/form', {
      item,
      roles,
      action: `/admin/users/${item.id}`,
      isCreate: false
    });
  } catch (error) { return next(error); }
}

async function userUpdate(req, res, next) {
  try {
    const userId = Number(req.params.id);
    const [item, roles] = await Promise.all([
      adminUserModel.getUserById(userId),
      adminUserModel.listRoles()
    ]);
    if (!item) return res.redirect('/admin/users');

    const { errors, payload } = validateUserPayload(req.body, false);
    const roleId = await adminUserModel.getRoleIdByCode(payload.roleCode);
    if (!roleId) errors.push('Роль не найдена');

      const emailUsed = await adminUserModel.emailExists(payload.email, userId);
      if (emailUsed) errors.push('Пользователь с таким email уже существует');

      if (req.session.user && req.session.user.id === userId) {
        if (payload.roleCode !== 'admin') {
          errors.push('Администратор не может понизить свою роль');
        }
        if (!normalizeBool(req.body.is_active)) {
          errors.push('Администратор не может отключить свой аккаунт');
        }
      }

    if (errors.length) {
      return renderAdmin(res, 'admin/users/form', {
        item: {
          ...item,
          full_name: payload.fullName,
          email: payload.email,
            phone: payload.phone,
            role_code: payload.roleCode,
            is_active: normalizeBool(req.body.is_active),
            can_review_product: payload.canReviewProduct,
            can_review_store: payload.canReviewStore
          },
        roles,
        action: `/admin/users/${userId}`,
        isCreate: false,
        errors
      });
    }

    let passwordHash = '';
    if (payload.password && payload.password.length >= 6) {
      passwordHash = await bcrypt.hash(payload.password, 10);
    }

    await adminUserModel.updateUser(userId, {
      role_id: roleId,
      full_name: payload.fullName,
      email: payload.email,
        phone: payload.phone,
        is_active: normalizeBool(req.body.is_active),
        can_review_product: payload.canReviewProduct,
        can_review_store: payload.canReviewStore,
        password_hash: passwordHash
      });

    return res.redirect('/admin/users');
  } catch (error) { return next(error); }
}

async function userDelete(req, res, next) {
  try {
    const userId = Number(req.params.id);
    if (req.session.user && req.session.user.id === userId) {
      return res.redirect('/admin/users');
    }
    await adminUserModel.setUserActive(userId, false);
    return res.redirect('/admin/users');
  } catch (error) { return next(error); }
}

async function userActivate(req, res, next) {
  try {
    const userId = Number(req.params.id);
    await adminUserModel.setUserActive(userId, true);
    return res.redirect('/admin/users');
  } catch (error) { return next(error); }
}

async function userHardDelete(req, res, next) {
  try {
    const userId = Number(req.params.id);
    if (req.session.user && req.session.user.id === userId) {
      return res.redirect('/admin/users');
    }
    await adminUserModel.hardDeleteUser(userId);
    return res.redirect('/admin/users');
  } catch (error) { return next(error); }
}
module.exports = {
  dashboard,
  categoriesList,
  categoryNewForm,
  categoryCreate,
  categoryEditForm,
  categoryUpdate,
  categoryDelete,
  productsList,
  productNewForm,
  productCreate,
  productEditForm,
  productUpdate,
  productDelete,
  discountsList,
  discountNewForm,
  discountCreate,
  discountEditForm,
  discountUpdate,
  discountDelete,
  productReviewsList,
  storeReviewsList,
  productReviewToggle,
  storeReviewToggle,
  productReviewNewForm,
  productReviewCreate,
  productReviewEditForm,
  productReviewUpdate,
  productReviewDelete,
  storeReviewNewForm,
  storeReviewCreate,
  storeReviewEditForm,
  storeReviewUpdate,
  storeReviewDelete,
  ordersList,
  orderEditForm,
  orderUpdate,
  dispatchList,
  dispatchAssign,
  usersList,
  userNewForm,
  userCreate,
  userEditForm,
  userUpdate,
  userDelete,
  userActivate,
  userHardDelete
};



