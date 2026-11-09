const { AppError } = require('./errorHandler');

const PRODUCT_FIELDS = [
  'name',
  'sku',
  'category',
  'price',
  'quantity',
  'reorderLevel',
  'supplier',
];
const STRING_FIELDS = ['name', 'sku', 'category', 'supplier'];
const REQUIRED_FIELDS = ['name', 'sku', 'category', 'price'];
const SORTABLE_FIELDS = [
  'name',
  'sku',
  'category',
  'price',
  'quantity',
  'reorderLevel',
  'supplier',
  'createdAt',
  'updatedAt',
];
const QUERY_FIELDS = [
  'search',
  'category',
  'minPrice',
  'maxPrice',
  'sort',
  'page',
  'limit',
];

const MAX_LIMIT = 100;
const DEFAULT_LIMIT = 10;
const MAX_SEARCH_LENGTH = 100;
const OBJECT_ID_REGEX = /^[0-9a-fA-F]{24}$/;
const DECIMAL_REGEX = /^\d+(\.\d+)?$/;
const INTEGER_REGEX = /^\d+$/;

const isPlainObject = (value) =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

const has = (obj, key) => Object.prototype.hasOwnProperty.call(obj, key);

const validationError = (errors) =>
  new AppError(400, 'Validation failed', errors);

const sanitizeProductBody = (body, requireAll) => {
  if (!isPlainObject(body)) {
    throw new AppError(400, 'Request body must be a JSON object');
  }

  const errors = [];
  const clean = {};
  const keys = Object.keys(body);

  const unknown = keys.filter((key) => !PRODUCT_FIELDS.includes(key));
  if (unknown.length) {
    errors.push(`Unknown field(s): ${unknown.join(', ')}`);
  }

  if (requireAll) {
    REQUIRED_FIELDS.forEach((field) => {
      if (!has(body, field)) errors.push(`${field} is required`);
    });
  } else if (keys.length === 0) {
    errors.push('At least one field must be provided');
  }

  PRODUCT_FIELDS.forEach((field) => {
    if (!has(body, field)) return;
    const value = body[field];

    if (STRING_FIELDS.includes(field)) {
      if (typeof value !== 'string') {
        errors.push(`${field} must be a string`);
        return;
      }
      const trimmed = value.trim();
      if (field !== 'supplier' && trimmed === '') {
        errors.push(`${field} cannot be empty`);
        return;
      }
      clean[field] = trimmed;
    } else if (field === 'price') {
      if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
        errors.push('price must be a finite, nonnegative number');
        return;
      }
      clean.price = value;
    } else {
      // quantity, reorderLevel
      if (!Number.isSafeInteger(value) || value < 0) {
        errors.push(`${field} must be a nonnegative safe integer`);
        return;
      }
      clean[field] = value;
    }
  });

  if (errors.length) throw validationError(errors);
  return clean;
};

const validateCreateProduct = (req, res, next) => {
  req.body = sanitizeProductBody(req.body, true);
  next();
};

const validateUpdateProduct = (req, res, next) => {
  req.body = sanitizeProductBody(req.body, false);
  next();
};

const validateStockChange = (req, res, next) => {
  const body = req.body;
  if (!isPlainObject(body)) {
    throw new AppError(400, 'Request body must be a JSON object');
  }

  const errors = [];
  const unknown = Object.keys(body).filter((key) => key !== 'change');
  if (unknown.length) {
    errors.push(`Unknown field(s): ${unknown.join(', ')}`);
  }
  if (!has(body, 'change')) {
    errors.push('change is required');
  } else if (!Number.isSafeInteger(body.change) || body.change === 0) {
    errors.push('change must be a non-zero safe integer');
  }

  if (errors.length) throw validationError(errors);
  req.body = { change: body.change };
  next();
};

const validateObjectId = (req, res, next) => {
  if (!OBJECT_ID_REGEX.test(req.params.id)) {
    throw new AppError(400, 'Invalid product ID');
  }
  next();
};

const validateProductQuery = (req, res, next) => {
  const q = req.query;
  const errors = [];

  const unknown = Object.keys(q).filter((key) => !QUERY_FIELDS.includes(key));
  if (unknown.length) {
    errors.push(`Unknown query parameter(s): ${unknown.join(', ')}`);
  }

  const readString = (name) => {
    if (!has(q, name)) return undefined;
    const value = q[name];
    if (typeof value !== 'string') {
      errors.push(`${name} must be a single string value`);
      return undefined;
    }
    const trimmed = value.trim();
    if (trimmed === '') {
      errors.push(`${name} cannot be empty`);
      return undefined;
    }
    return trimmed;
  };

  const readPrice = (name) => {
    const value = readString(name);
    if (value === undefined) return undefined;
    const number = Number(value);
    if (!DECIMAL_REGEX.test(value) || !Number.isFinite(number)) {
      errors.push(`${name} must be a nonnegative number`);
      return undefined;
    }
    return number;
  };

  const search = readString('search');
  if (search !== undefined && search.length > MAX_SEARCH_LENGTH) {
    errors.push(`search must be at most ${MAX_SEARCH_LENGTH} characters`);
  }

  const category = readString('category');
  const minPrice = readPrice('minPrice');
  const maxPrice = readPrice('maxPrice');
  if (minPrice !== undefined && maxPrice !== undefined && minPrice > maxPrice) {
    errors.push('minPrice cannot be greater than maxPrice');
  }

  let page = 1;
  const rawPage = readString('page');
  if (rawPage !== undefined) {
    const n = Number(rawPage);
    if (!INTEGER_REGEX.test(rawPage) || !Number.isSafeInteger(n) || n < 1) {
      errors.push('page must be a positive integer');
    } else {
      page = n;
    }
  }

  let limit = DEFAULT_LIMIT;
  const rawLimit = readString('limit');
  if (rawLimit !== undefined) {
    const n = Number(rawLimit);
    if (!INTEGER_REGEX.test(rawLimit) || !Number.isSafeInteger(n) || n < 1) {
      errors.push('limit must be a positive integer');
    } else {
      limit = Math.min(n, MAX_LIMIT);
    }
  }

  const skip = (page - 1) * limit;
  if (!Number.isSafeInteger(skip)) {
    errors.push('page is too large');
  }

  let sort = { createdAt: -1 };
  const rawSort = readString('sort');
  if (rawSort !== undefined) {
    sort = {};
    rawSort.split(',').forEach((part) => {
      const token = part.trim();
      const direction = token.startsWith('-') ? -1 : 1;
      const field = token.replace(/^-/, '');
      if (!SORTABLE_FIELDS.includes(field)) {
        errors.push(
          `Cannot sort by "${token}". Allowed fields: ${SORTABLE_FIELDS.join(', ')}`
        );
      } else if (has(sort, field)) {
        errors.push(`Duplicate sort field: ${field}`);
      } else {
        sort[field] = direction;
      }
    });
  }

  if (errors.length) throw validationError(errors);

  sort._id = 1; // stable tie-breaker

  req.listQuery = { search, category, minPrice, maxPrice, sort, page, limit, skip };
  next();
};

module.exports = {
  validateCreateProduct,
  validateUpdateProduct,
  validateStockChange,
  validateObjectId,
  validateProductQuery,
};
