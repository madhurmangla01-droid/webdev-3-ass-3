require('dotenv').config();

const express = require('express');
const mongoose = require('mongoose');
const Product = require('./models/Product');
const productRoutes = require('./routes/productRoutes');
const { notFound, errorHandler } = require('./middleware/errorHandler');

const PORT = Number(process.env.PORT) || 5000;
const MONGO_URI = process.env.MONGO_URI;

const app = express();

app.use(express.json());
app.use('/api/products', productRoutes);
app.use(notFound);
app.use(errorHandler);

const start = async () => {
  if (!MONGO_URI) {
    throw new Error('MONGO_URI is not defined. Copy .env.example to .env and set it.');
  }

  await mongoose.connect(MONGO_URI, { serverSelectionTimeoutMS: 5000 });
  console.log('MongoDB connected');

  await Product.init(); // make sure indexes (unique sku) exist
  console.log('Product indexes ready');

  const server = app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });

  server.on('error', (err) => {
    console.error('Server error:', err.message);
    process.exit(1);
  });
};

start().catch((err) => {
  console.error('Startup failed:', err.message);
  process.exit(1);
});
