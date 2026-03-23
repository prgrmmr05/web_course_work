const express = require('express');
const adminController = require('../controllers/admin.controller');
const { requireRole } = require('../middlewares/auth.middleware');

const router = express.Router();
const adminOnly = requireRole(['admin']);

router.use(requireRole(['admin', 'manager']));

router.get('/', adminController.dashboard);

router.get('/categories', adminController.categoriesList);
router.get('/categories/new', adminController.categoryNewForm);
router.post('/categories', adminController.categoryCreate);
router.get('/categories/:id/edit', adminController.categoryEditForm);
router.post('/categories/:id', adminController.categoryUpdate);
router.post('/categories/:id/delete', adminController.categoryDelete);

router.get('/products', adminController.productsList);
router.get('/products/new', adminController.productNewForm);
router.post('/products', adminController.productCreate);
router.get('/products/:id/edit', adminController.productEditForm);
router.post('/products/:id', adminController.productUpdate);
router.post('/products/:id/delete', adminController.productDelete);

router.get('/discounts', adminController.discountsList);
router.get('/discounts/new', adminController.discountNewForm);
router.post('/discounts', adminController.discountCreate);
router.get('/discounts/:id/edit', adminController.discountEditForm);
router.post('/discounts/:id', adminController.discountUpdate);
router.post('/discounts/:id/delete', adminController.discountDelete);
router.get('/promos', (req, res) => res.redirect('/admin/discounts'));

router.get('/reviews/products', adminController.productReviewsList);
router.get('/reviews/store', adminController.storeReviewsList);
router.post('/reviews/products/:id/toggle', adminController.productReviewToggle);
router.post('/reviews/store/:id/toggle', adminController.storeReviewToggle);
router.get('/reviews/products/new', adminController.productReviewNewForm);
router.post('/reviews/products', adminController.productReviewCreate);
router.get('/reviews/products/:id/edit', adminController.productReviewEditForm);
router.post('/reviews/products/:id', adminController.productReviewUpdate);
router.post('/reviews/products/:id/delete', adminController.productReviewDelete);
router.get('/reviews/store/new', adminController.storeReviewNewForm);
router.post('/reviews/store', adminController.storeReviewCreate);
router.get('/reviews/store/:id/edit', adminController.storeReviewEditForm);
router.post('/reviews/store/:id', adminController.storeReviewUpdate);
router.post('/reviews/store/:id/delete', adminController.storeReviewDelete);

router.get('/orders', adminController.ordersList);
router.get('/orders/:id/edit', adminController.orderEditForm);
router.post('/orders/:id', adminController.orderUpdate);

router.get('/dispatch', adminController.dispatchList);
router.post('/dispatch/:id', adminController.dispatchAssign);

router.get('/users', adminOnly, adminController.usersList);
router.get('/users/new', adminOnly, adminController.userNewForm);
router.post('/users', adminOnly, adminController.userCreate);
router.get('/users/:id/edit', adminOnly, adminController.userEditForm);
router.post('/users/:id', adminOnly, adminController.userUpdate);
router.post('/users/:id/delete', adminOnly, adminController.userDelete);
router.post('/users/:id/activate', adminOnly, adminController.userActivate);
router.post('/users/:id/hard-delete', adminOnly, adminController.userHardDelete);

module.exports = router;
