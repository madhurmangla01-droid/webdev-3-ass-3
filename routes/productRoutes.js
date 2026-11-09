const express = require('express');
const controller = require('../controllers/productController');
const {
  validateCreateProduct,
  validateUpdateProduct,
  validateStockChange,
  validateObjectId,
  validateProductQuery,
} = require('../middleware/validateProduct');

const router = express.Router();

// Static routes MUST be registered before /:id
router.get('/low-stock', controller.getLowStock);
router.get('/summary', controller.getSummary);

router.post('/', validateCreateProduct, controller.createProduct);
router.get('/', validateProductQuery, controller.getProducts);

router.patch(
  '/:id/stock',
  validateObjectId,
  validateStockChange,
  controller.updateStock
);

router.get('/:id', validateObjectId, controller.getProductById);
router.put(
  '/:id',
  validateObjectId,
  validateUpdateProduct,
  controller.updateProduct
);
router.delete('/:id', validateObjectId, controller.deleteProduct);

module.exports = router;
