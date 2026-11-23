# Inventory & Order Management API

This API uses Express, Mongoose, and ES modules. Routes, controllers, models,
middleware, and configuration are kept in separate folders.

## Run locally

1. Run `npm install` from this folder.
2. Create `.env` and set `DB`, `JWT_SECRET`, and `CLIENT_URL`.
3. Run `npm start`.

The API listens on port `5000` by default. The database connection must succeed
before the server starts accepting requests. Order creation, cancellation, and
inventory adjustments use MongoDB transactions, so the local MongoDB server
must run as a replica set. For the example URI, configure `mongod` with
`replication.replSetName: rs0`, restart it, and run `rs.initiate()` once in
`mongosh`. Keep `JWT_SECRET` private and do not commit `.env`.

## Accounts and access

Anyone can register a staff account and all staff accounts have equal access.
On protected routes, send a `Bearer` token using the `Authorization` header.
Tokens expire after one hour. `POST /auth/logout` revokes the current session;
the client should discard the token after a successful logout.

- Products, inventory movements, orders, categories, and customer records
  belong to the account that created them. Each account can access only its own
  business data.
- Each staff member can view and update only their own profile.

Records without an owner (for example, data created before account-level
ownership was added) are hidden until reviewed and assigned. Products are
assigned to the signed-in user when created. Removing a product archives it
from active inventory instead of deleting its record, preserving order and
stock-movement history.

For an existing deployment, back up the database, deploy the ownership changes,
then run `npm run migrate:tenant-indexes` from this folder with the production
`DB` connection configured. This changes globally unique SKU, category,
customer-contact, and order-number indexes to be unique per account. The
migration does not assign ownerless records; those remain in MongoDB but hidden
until reviewed.

## Endpoints

| Method | Path | Access | Purpose |
| --- | --- | --- | --- |
| POST | `/auth/register` | Public | Register a staff account |
| POST | `/auth/login` | Public | Log in |
| POST | `/auth/logout` | Authenticated | Revoke the current session |
| GET | `/users/me` | Authenticated | Get the signed-in user's profile |
| PATCH | `/users/me` | Authenticated | Update own name/email; verify current password to change password |
| GET | `/products` | Authenticated | Search, filter, sort, and paginate own products |
| GET | `/products/:id` | Authenticated | Get product details |
| POST | `/products` | Authenticated | Create a workspace product |
| PATCH | `/products/:id` | Authenticated | Update product details |
| DELETE | `/products/:id` | Authenticated | Archive a product from active inventory |
| GET | `/categories` | Authenticated | List own categories and product counts |
| POST | `/categories` | Authenticated | Create a category for the current account |
| PATCH | `/categories/:id` | Authenticated | Update an own category |
| DELETE | `/categories/:id` | Authenticated | Delete an unused own category |
| GET | `/inventory` | Authenticated | Workspace inventory counts and low-stock threshold |
| GET | `/inventory/low-stock` | Authenticated | Paginated low-stock products |
| GET | `/inventory/out-of-stock` | Authenticated | Paginated out-of-stock products |
| GET | `/inventory/movements` | Authenticated | Paginated workspace inventory movement history |
| PATCH | `/inventory/:productId/adjust` | Authenticated | Add/remove product stock |
| GET | `/orders` | Authenticated | List own orders with search and filters |
| POST | `/orders` | Authenticated | Create an order and reduce product stock |
| GET | `/orders/:id` | Authenticated | View order and status history |
| PATCH | `/orders/:id/status` | Authenticated | Process, complete, or cancel an order |
| GET | `/orders/:id/history` | Authenticated | View order with complete status history |
| GET | `/customers` | Authenticated | Search and paginate own customers |
| POST | `/customers` | Authenticated | Add an own customer with unique contact details |
| GET | `/customers/:id` | Authenticated | View an own customer |
| GET | `/customers/:id/orders` | Authenticated | View own orders for a customer |
| PATCH | `/customers/:id` | Authenticated | Update an own customer |
| DELETE | `/customers/:id` | Authenticated | Delete an own customer without order history |
| GET | `/dashboard` | Authenticated | Workspace-wide product, order, and completed-sales summary |

Product listing query parameters: `search` (name or SKU), `category`,
`stockStatus` (`in_stock` or `out_of_stock`), `sortBy` (`name`, `price`, or
`quantity`), `sortOrder` (`asc` or `desc`), `page`, and `limit` (maximum 100).

Product creation requires `name`, `sku`, and `price`. `category`,
`description`, and `imageUrl` are optional. New products start with zero stock;
use the inventory adjustment endpoint to add stock so that the movement is
recorded. Inventory adjustments accept `{ "change": 10, "reason": "..." }`;
negative changes remove stock, but never below zero.

Order creation accepts `{ "customerId": "...", "items": [{ "productId":
"...", "quantity": 2 }] }`. The server reads prices from the database, saves
price/name/SKU snapshots, and calculates totals. Optionally send an
`Idempotency-Key` header to safely retry the same create request. Allowed status
changes are Pending to Processing or Cancelled, and Processing to Completed or
Cancelled. Cancellation restores stock in the same transaction. A customer
must have a unique email or phone number.

Set `LOW_STOCK_THRESHOLD` to a non-negative whole number; it defaults to `5`.
Run the backend checks with `npm test`.
