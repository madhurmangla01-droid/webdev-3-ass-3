const Product = require('../models/Product');
const { AppError } = require('../middleware/errorHandler');

const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

const escapeRegex = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const createProduct = async (req, res) => {
  const product = await Product.create(req.body);
  res.status(201).json(product);
};

const getProducts = async (req, res) => {
  const { search, category, minPrice, maxPrice, sort, page, limit, skip } =
    req.listQuery;

  const filter = {};
  if (search !== undefined) {
    filter.name = { $regex: escapeRegex(search), $options: 'i' };
  }
  if (category !== undefined) {
    filter.category = category;
  }
  if (minPrice !== undefined || maxPrice !== undefined) {
    filter.price = {};
    if (minPrice !== undefined) filter.price.$gte = minPrice;
    if (maxPrice !== undefined) filter.price.$lte = maxPrice;
  }

  const [total, products] = await Promise.all([
    Product.countDocuments(filter),
    Product.find(filter).sort(sort).skip(skip).limit(limit),
  ]);

  res.json({
    total,
    page,
    totalPages: Math.ceil(total / limit),
    count: products.length,
    products,
  });
};

const getProductById = async (req, res) => {
  const product = await Product.findById(req.params.id);
  if (!product) {
    throw new AppError(404, 'Product not found');
  }
  res.json(product);
};

const updateProduct = async (req, res) => {
  const product = await Product.findByIdAndUpdate(
    req.params.id,
    { $set: req.body },
    { new: true, runValidators: true }
  );
  if (!product) {
    throw new AppError(404, 'Product not found');
  }
  res.json(product);
};

const updateStock = async (req, res) => {
  const { id } = req.params;
  const { change } = req.body;

  // Condition checked atomically together with the $inc:
  //  - sale (change < 0): quantity must be >= amount sold
  //  - restock (change > 0): result must stay <= Number.MAX_SAFE_INTEGER
  const quantityCondition =
    change > 0
      ? { $lte: Number.MAX_SAFE_INTEGER - change }
      : { $gte: -change };

  const product = await Product.findOneAndUpdate(
    { _id: id, quantity: quantityCondition },
    { $inc: { quantity: change } },
    { new: true }
  );

  if (product) {
    return res.json({ message: 'Stock updated', product });
  }

  // Update did not match: find out why.
  const current = await Product.findById(id).select('quantity');
  if (!current) {
    throw new AppError(404, 'Product not found');
  }
  if (change < 0) {
    throw new AppError(
      409,
      `Insufficient stock: available ${current.quantity}, requested ${-change}`
    );
  }
  throw new AppError(
    409,
    'Stock update would exceed the maximum safe integer quantity'
  );
};

const deleteProduct = async (req, res) => {
  const product = await Product.findByIdAndDelete(req.params.id);
  if (!product) {
    throw new AppError(404, 'Product not found');
  }
  res.json({ message: 'Product deleted', id: String(product._id) });
};

const getLowStock = async (req, res) => {
  const lowStockItems = await Product.aggregate([
    { $match: { $expr: { $lte: ['$quantity', '$reorderLevel'] } } },
    {
      $addFields: {
        stockValue: { $multiply: ['$price', '$quantity'] },
        id: { $toString: '$_id' },
      },
    },
    { $sort: { quantity: 1, name: 1, _id: 1 } },
  ]);

  res.json({ count: lowStockItems.length, lowStockItems });
};

const getSummary = async (req, res) => {
  const summary = await Product.aggregate([
    {
      $group: {
        _id: '$category',
        totalItems: { $sum: 1 },
        totalQuantity: { $sum: '$quantity' },
        totalStockValue: { $sum: { $multiply: ['$price', '$quantity'] } },
        avgPrice: { $avg: '$price' },
      },
    },
    { $sort: { totalStockValue: -1, _id: 1 } },
  ]);

  res.json({ categories: summary.length, summary });
};

module.exports = {
  createProduct: asyncHandler(createProduct),
  getProducts: asyncHandler(getProducts),
  getProductById: asyncHandler(getProductById),
  updateProduct: asyncHandler(updateProduct),
  updateStock: asyncHandler(updateStock),
  deleteProduct: asyncHandler(deleteProduct),
  getLowStock: asyncHandler(getLowStock),
  getSummary: asyncHandler(getSummary),
};
