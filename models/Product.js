const mongoose = require('mongoose');

const isSafeNonNegativeInteger = (value) =>
  Number.isSafeInteger(value) && value >= 0;

const productSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'name is required'],
      trim: true,
    },
    sku: {
      type: String,
      required: [true, 'sku is required'],
      unique: true,
      trim: true,
    },
    category: {
      type: String,
      required: [true, 'category is required'],
      trim: true,
    },
    price: {
      type: Number,
      required: [true, 'price is required'],
      min: [0, 'price must not be negative'],
      validate: {
        validator: Number.isFinite,
        message: 'price must be a finite number',
      },
    },
    quantity: {
      type: Number,
      default: 0,
      min: [0, 'quantity must not be negative'],
      validate: {
        validator: isSafeNonNegativeInteger,
        message: 'quantity must be a nonnegative safe integer',
      },
    },
    reorderLevel: {
      type: Number,
      default: 5,
      min: [0, 'reorderLevel must not be negative'],
      validate: {
        validator: isSafeNonNegativeInteger,
        message: 'reorderLevel must be a nonnegative safe integer',
      },
    },
    supplier: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: true,
    versionKey: false,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

productSchema.virtual('stockValue').get(function () {
  return this.price * this.quantity;
});

module.exports = mongoose.model('Product', productSchema);
