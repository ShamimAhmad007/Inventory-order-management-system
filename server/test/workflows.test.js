import assert from "node:assert/strict";
import test from "node:test";
import bcrypt from "bcrypt";
import mongoose from "mongoose";
import { findPasswordMatch } from "../controller/auth.controller.js";
import {
  createCustomer,
  customerOrderFilter,
} from "../controller/customer.controller.js";
import { updateProfile } from "../controller/User.controller.js";
import { createOrder, normalizeOrderItems, toCents, validOrderTransitions } from "../controller/order.controller.js";
import { createProduct, productAccessFilter } from "../controller/product.controller.js";
import User from "../models/User.js";
import Product from "../models/product.js";

function createResponse() {
  return {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };
}

test("login matches the password against duplicate email records", async () => {
  const firstUser = {
    password: await bcrypt.hash("staff-password", 4),
  };
  const secondUser = {
    password: await bcrypt.hash("other-password", 4),
  };

  assert.equal(await findPasswordMatch([firstUser, secondUser], "other-password"), secondUser);
  assert.equal(await findPasswordMatch([firstUser, secondUser], "wrong-password"), null);
});

test("login rejects a password matching multiple duplicate email records", async () => {
  const password = await bcrypt.hash("shared-password", 4);
  assert.equal(
    await findPasswordMatch(
      [{ password }, { password }],
      "shared-password",
    ),
    null,
  );
});

test("product schema accepts two-decimal prices and rejects fractional stock", async () => {
  const product = new Product({
    name: "Keyboard",
    sku: "KEY-001",
    category: new mongoose.Types.ObjectId(),
    price: 49.99,
    stock: 5,
  });
  await product.validate();

  product.stock = 1.5;
  await assert.rejects(product.validate(), (error) => Boolean(error.errors.stock));

  product.stock = 5;
  product.price = 49.999;
  await assert.rejects(product.validate(), (error) => Boolean(error.errors.price));
});

test("product access includes the shared workspace", () => {
  assert.deepEqual(productAccessFilter(), {});
});

test("customer order history includes all workspace orders for that customer", () => {
  assert.deepEqual(customerOrderFilter("customer-1"), { customer: "customer-1" });
});

test("user accounts do not include role-based access", () => {
  assert.equal(User.schema.path("role"), undefined);
});

test("products can be owned by users without requiring a category", async () => {
  const product = new Product({
    name: "Notebook",
    sku: "NOTE-003",
    owner: new mongoose.Types.ObjectId(),
    price: 4.5,
    stock: 5,
  });
  await product.validate();
});

test("order item normalization merges duplicate products and validates quantities", () => {
  const productId = new mongoose.Types.ObjectId().toString();
  assert.deepEqual(normalizeOrderItems([
    { productId, quantity: 2 },
    { productId, quantity: 3 },
  ]), [{ productId, quantity: 5 }]);
  assert.equal(normalizeOrderItems([{ productId, quantity: 0 }]), null);
  assert.equal(toCents(19.99), 1999);
});

test("order statuses permit only expected transitions", () => {
  assert.deepEqual(validOrderTransitions.Pending, ["Processing", "Cancelled"]);
  assert.deepEqual(validOrderTransitions.Completed, []);
  assert.deepEqual(validOrderTransitions.Cancelled, []);
});

test("invalid order requests are rejected before any database access", async () => {
  const response = createResponse();
  await createOrder({ body: { customerId: "invalid", items: [] }, get: () => undefined }, response);
  assert.equal(response.statusCode, 400);
  assert.equal(response.body.success, false);
});

test("invalid customer input is rejected before any database access", async () => {
  const response = createResponse();
  await createCustomer({ body: { name: "No contact" } }, response);
  assert.equal(response.statusCode, 400);
  assert.equal(response.body.success, false);
});

test("product creation rejects positive stock so inventory has an audit entry", async () => {
  const response = createResponse();
  await createProduct({
    body: {
      name: "Keyboard",
      sku: "KEY-002",
      category: new mongoose.Types.ObjectId().toString(),
      price: 10,
      stock: 3,
    },
  }, response);
  assert.equal(response.statusCode, 400);
  assert.equal(response.body.success, false);
});

test("profile update rejects invalid email before loading the account", async () => {
  const response = createResponse();
  await updateProfile({ user: { id: "user-1" }, body: { email: "invalid" } }, response);
  assert.equal(response.statusCode, 400);
  assert.equal(response.body.success, false);
});

test("profile password change requires a current password", async () => {
  const response = createResponse();
  await updateProfile(
    { user: { id: "user-1" }, body: { name: "Staff", newPassword: "password-123" } },
    response,
  );
  assert.equal(response.statusCode, 400);
  assert.equal(response.body.success, false);
});
