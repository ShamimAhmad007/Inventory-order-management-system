# Northstar Supply frontend

Responsive React workspace for the Inventory & Order Management API.

## Run locally

1. Start MongoDB and the backend server; see `../server/README.md`.
2. In this folder, run `npm install`.
3. Copy `.env.example` to `.env` and set `VITE_API_URL` if the backend is not
   available at `http://localhost:5000`.
4. Run `npm run dev` and open the local Vite URL.

Anyone can register a staff account. All staff accounts have the same access.

## Workspace screens

- **Products:** list, search, filter, sort, paginate, inspect, create, edit, and
  archive workspace products.
- **Categories:** view category product counts; create, edit, and delete shared
  categories.
- **Inventory:** add and view workspace inventory items, update stock with a
  reason, edit item details, and archive items.
- **Stock activity:** review low-stock and out-of-stock products and inspect
  workspace inventory movement history.
- **Orders:** search and filter workspace orders, create multi-product orders,
  view item and status history, and process or cancel eligible orders.
- **Customers:** add and search shared customer records, view order history, and
  edit or delete customers.
- **My profile:** update your own name, email, and password.

Products removed from active inventory are archived to preserve order history.
Inventory cards use a stable random placeholder photo when no product image URL
is present.

## Dashboard

The Dashboard summarizes workspace inventory and orders, including order
statuses, completed sales, low and out-of-stock items, recent orders, best
sellers, and a six-month sales trend. Sales totals include completed orders
only. Summary cards link to the inventory or orders list.

The interface stores the session token in browser local storage and sends it as
a bearer token to protected API endpoints. Logout revokes the current server
session and removes the token from the browser.

Run `npm run lint` and `npm run build` to validate the frontend.
