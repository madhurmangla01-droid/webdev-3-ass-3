# Inventory and Data Management API

REST API built with Node.js, Express, MongoDB, Mongoose and dotenv.

## Installation

```bash
npm install
cp .env.example .env     # Windows: copy .env.example .env
```

## Database configuration

Edit `.env`:

```
PORT=5000
MONGO_URI=mongodb://127.0.0.1:27017/inventory_db
```

MongoDB must be running locally (or use a MongoDB Atlas connection string).

## Start

```bash
npm start
```

The server connects to MongoDB, builds the indexes, then listens on port 5000.
If startup fails, the error is printed and the process exits.

## Endpoints (base: http://localhost:5000)

| Method | URL | Purpose |
|--------|-----|---------|
| POST   | /api/products | Create product (201) |
| GET    | /api/products | List with filters, sort, pagination |
| GET    | /api/products/:id | Get one product |
| PUT    | /api/products/:id | Update supplied fields |
| PATCH  | /api/products/:id/stock | Body `{ "change": 10 }` or `{ "change": -3 }` |
| DELETE | /api/products/:id | Delete product |
| GET    | /api/products/low-stock | Products with quantity <= reorderLevel |
| GET    | /api/products/summary | Totals grouped by category |

### List query parameters

`search` (name, case-insensitive), `category` (exact), `minPrice`, `maxPrice`,
`sort` (e.g. `price`, `-price`, `category,-price`; allowed: name, sku, category,
price, quantity, reorderLevel, supplier, createdAt, updatedAt), `page` (default 1),
`limit` (default 10, max 100).

Example: `GET /api/products?search=phone&category=Electronics&minPrice=100&maxPrice=5000&sort=-price&page=1&limit=10`

### Example request bodies

POST /api/products
```json
{
  "name": "Wireless Mouse",
  "sku": "MOU-001",
  "category": "Electronics",
  "price": 799.5,
  "quantity": 20,
  "reorderLevel": 5,
  "supplier": "Logi Traders"
}
```

PUT /api/products/:id (omitted fields are kept)
```json
{ "price": 899, "supplier": "New Supplier" }
```

PATCH /api/products/:id/stock
```json
{ "change": 10 }
```
```json
{ "change": -3 }
```

### Error format

```json
{ "error": { "status": 400, "message": "Validation failed", "details": ["price is required"] } }
```

Status codes: 400 invalid input, 404 not found, 409 duplicate SKU / insufficient
stock, 500 unexpected error.

## Postman testing

1. Create a collection and a variable `baseUrl` = `http://localhost:5000`.
2. For POST/PUT/PATCH, choose Body > raw > JSON and send the sample bodies.
3. Create a product, copy the returned `id` into a variable `productId`,
   then call the `/:id`, PUT, PATCH stock and DELETE requests with it.
4. Send the same SKU twice (expect 409), then invalid bodies (expect 400).

## Test checklist

- POST valid product returns 201 with `stockValue` and `id`.
- GET `/api/products` returns `total`, `page`, `totalPages`, `count`, `products`.
- Filters `search`, `category`, `minPrice`, `maxPrice` work; `total` counts all matches.
- `sort=price` / `sort=-price` work; `sort=hack` returns 400.
- `limit=500` is capped at 100; `page=0` or `limit=abc` returns 400.
- `search=(` or `search=.*` does not crash (regex escaped).
- GET `/:id`: malformed ID returns 400; unknown valid ID returns 404.
- PUT changes only supplied fields; empty body, unknown field or `"price": "abc"` returns 400.
- Duplicate SKU on POST and PUT returns 409.
- Missing fields, negative price, `quantity: 1.5` or extra field returns 400; malformed JSON returns 400.
- PATCH `{ "change": 10 }` raises stock, `{ "change": -3 }` lowers it.
- PATCH `{ "change": -9999 }` returns 409 and quantity is unchanged.
- PATCH `0`, `1.5`, `"5"` or `{}` returns 400; unknown valid ID returns 404.
- PATCH `{ "change": 9007199254740991 }` on a product with stock returns 409.
- GET `/low-stock` returns `count` and `lowStockItems` (quantity <= reorderLevel, with `stockValue` and `id`).
- GET `/summary` returns `categories` and `summary`, sorted by `totalStockValue` descending.
- DELETE returns `{ "message": "Product deleted", "id": "..." }`; deleting again returns 404.
