import mongoose from "mongoose";
import { createHash, randomBytes } from "node:crypto";
import Customer from "../models/customer.js";
import InventoryMovement from "../models/inventory.js";
import Order from "../models/order.js";
import Product from "../models/product.js";

export const validOrderTransitions = {
  Pending: ["Processing", "Cancelled"],
  Processing: ["Completed", "Cancelled"],
  Completed: [],
  Cancelled: [],
};

export function normalizeOrderItems(items) {
  if (!Array.isArray(items) || items.length === 0 || items.length > 100) {
    return null;
  }
  const quantities = new Map();
  for (const item of items) {
    if (
      !item ||
      !mongoose.isValidObjectId(item.productId) ||
      !Number.isInteger(item.quantity) ||
      item.quantity < 1 ||
      item.quantity > 10000
    ) {
      return null;
    }
    const key = item.productId.toString();
    const quantity = (quantities.get(key) ?? 0) + item.quantity;
    if (quantity > 10000) return null;
    quantities.set(key, quantity);
  }
  return [...quantities.entries()]
    .map(([productId, quantity]) => ({ productId, quantity }))
    .sort((left, right) => left.productId.localeCompare(right.productId));
}

export function toCents(amount) {
  return Math.round(amount * 100);
}

export function createOrderFingerprint(customerId, items) {
  return createHash("sha256")
    .update(JSON.stringify({ customerId, items }))
    .digest("hex");
}

function httpError(message, status) {
  return Object.assign(new Error(message), { status });
}

function pageSettings(query) {
  const page = Math.max(Number.parseInt(query.page, 10) || 1, 1);
  const limit = Math.min(
    Math.max(Number.parseInt(query.limit, 10) || 20, 1),
    100,
  );
  return { page, limit };
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export async function createOrder(req, res) {
  const { customerId } = req.body ?? {};
  const items = normalizeOrderItems(req.body?.items);
  if (!mongoose.isValidObjectId(customerId) || !items) {
    return res.status(400).json({
      success: false,
      message: "Provide a valid customer id and one or more valid order items",
    });
  }
  const idempotencyKey = req.get("idempotency-key")?.trim();
  if (idempotencyKey && idempotencyKey.length > 100) {
    return res.status(400).json({
      success: false,
      message: "Idempotency-Key must be at most 100 characters",
    });
  }
  const fingerprint = createOrderFingerprint(customerId.toString(), items);

  if (idempotencyKey) {
    const existing = await Order.findOne({
      createdBy: req.user.id,
      idempotencyKey,
    });
    if (existing) {
      if (existing.requestFingerprint !== fingerprint) {
        return res.status(409).json({
          success: false,
          message: "Idempotency-Key was already used for a different order",
        });
      }
      return res.status(200).json({
        success: true,
        message: "Order already created",
        order: existing,
      });
    }
  }

  const session = await mongoose.startSession();
  const orderNumber = `ORD-${Date.now()}-${randomBytes(4).toString("hex").toUpperCase()}`;
  let orderId;
  try {
    await session.withTransaction(async () => {
      const customer = await Customer.findById(customerId).session(session);
      if (!customer) throw httpError("Customer not found", 404);
      const customerUpdate = await Customer.updateOne(
        { _id: customer._id },
        { $inc: { orderCount: 1 } },
        { session },
      );
      if (customerUpdate.matchedCount !== 1) {
        throw httpError("Customer is no longer available", 409);
      }

      const productIds = items.map((item) => item.productId);
      const productFilter = {
        _id: { $in: productIds },
        archivedAt: null,
      };
      const products = await Product.find(productFilter).session(session);
      const productById = new Map(
        products.map((product) => [product._id.toString(), product]),
      );
      if (products.length !== items.length) {
        throw httpError("One or more products were not found", 404);
      }

      const orderItems = [];
      let subtotalCents = 0;
      for (const item of items) {
        const product = productById.get(item.productId);
        const unitPriceCents = toCents(product.price);
        const lineTotalCents = unitPriceCents * item.quantity;
        if (!Number.isSafeInteger(lineTotalCents)) {
          throw httpError("Order total exceeds the supported limit", 400);
        }
        subtotalCents += lineTotalCents;
        orderItems.push({
          product: product._id,
          name: product.name,
          sku: product.sku,
          quantity: item.quantity,
          unitPrice: unitPriceCents / 100,
          lineTotal: lineTotalCents / 100,
        });
      }
      if (!Number.isSafeInteger(subtotalCents)) {
        throw httpError("Order total exceeds the supported limit", 400);
      }

      const orderObjectId = new mongoose.Types.ObjectId();
      const movementEntries = [];
      for (const item of items) {
        const product = productById.get(item.productId);
        const updated = await Product.findOneAndUpdate(
          { _id: product._id, stock: { $gte: item.quantity } },
          { $inc: { stock: -item.quantity } },
          { returnDocument: "after", session, runValidators: true },
        );
        if (!updated) {
          throw httpError(`Insufficient stock for ${product.name}`, 409);
        }
        movementEntries.push({
          product: product._id,
          change: -item.quantity,
          quantityBefore: updated.stock + item.quantity,
          quantityAfter: updated.stock,
          reason: `Order ${orderNumber}`,
          type: "order",
          performedBy: req.user.id,
          order: orderObjectId,
        });
      }

      const [order] = await Order.create(
        [
          {
            _id: orderObjectId,
            orderNumber,
            idempotencyKey: idempotencyKey || undefined,
            requestFingerprint: idempotencyKey ? fingerprint : undefined,
            customer: customer._id,
            customerSnapshot: {
              name: customer.name,
              email: customer.email ?? "",
              phone: customer.phone ?? "",
              address: customer.address,
            },
            items: orderItems,
            subtotal: subtotalCents / 100,
            total: subtotalCents / 100,
            createdBy: req.user.id,
            statusHistory: [
              { status: "Pending", changedBy: req.user.id, note: "Order created" },
            ],
          },
        ],
        { session },
      );
      await InventoryMovement.create(movementEntries, { session });
      orderId = order._id;
    });
  } catch (error) {
    if (error.code === 11000 && idempotencyKey) {
      const existing = await Order.findOne({
        createdBy: req.user.id,
        idempotencyKey,
      });
      if (existing?.requestFingerprint === fingerprint) {
        return res.status(200).json({
          success: true,
          message: "Order already created",
          order: existing,
        });
      }
    }
    throw error;
  } finally {
    await session.endSession();
  }

  const order = await Order.findById(orderId)
    .populate("customer", "name email phone address")
    .populate("createdBy", "name email");
  return res.status(201).json({ success: true, message: "Order created", order });
}

export async function getOrders(req, res) {
  const { page, limit } = pageSettings(req.query);
  const filter = {};

  if (req.query.status !== undefined) {
    if (!["Pending", "Processing", "Completed", "Cancelled"].includes(req.query.status)) {
      return res.status(400).json({ success: false, message: "Invalid order status" });
    }
    filter.status = req.query.status;
  }
  if (req.query.from || req.query.to) {
    const createdAt = {};
    if (req.query.from) {
      const from = new Date(req.query.from);
      if (Number.isNaN(from.getTime())) {
        return res.status(400).json({ success: false, message: "Invalid from date" });
      }
      createdAt.$gte = from;
    }
    if (req.query.to) {
      const to = new Date(req.query.to);
      if (Number.isNaN(to.getTime())) {
        return res.status(400).json({ success: false, message: "Invalid to date" });
      }
      createdAt.$lte = to;
    }
    filter.createdAt = createdAt;
  }
  if (typeof req.query.search === "string" && req.query.search.trim()) {
    const search = new RegExp(escapeRegex(req.query.search.trim()), "i");
    filter.$or = [{ orderNumber: search }, { "customerSnapshot.name": search }];
  }

  const [orders, total] = await Promise.all([
    Order.find(filter)
      .populate("customer", "name email phone")
      .populate("createdBy", "name email")
      .sort({ createdAt: -1, _id: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    Order.countDocuments(filter),
  ]);
  return res.json({
    success: true,
    orders,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  });
}

export async function getOrder(req, res) {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(400).json({ success: false, message: "Invalid order id" });
  }
  const filter = { _id: req.params.id };
  const order = await Order.findOne(filter)
    .populate("customer", "name email phone address")
    .populate("createdBy", "name email")
    .populate("statusHistory.changedBy", "name email");
  if (!order) {
    return res.status(404).json({ success: false, message: "Order not found" });
  }
  return res.json({ success: true, order });
}

export async function updateOrderStatus(req, res) {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(400).json({ success: false, message: "Invalid order id" });
  }
  const { status, note = "" } = req.body ?? {};
  if (
    !["Pending", "Processing", "Completed", "Cancelled"].includes(status) ||
    typeof note !== "string" ||
    note.length > 300
  ) {
    return res.status(400).json({
      success: false,
      message: "Provide a valid order status and note of at most 300 characters",
    });
  }

  const session = await mongoose.startSession();
  let orderId;
  try {
    await session.withTransaction(async () => {
      const order = await Order.findById(req.params.id).session(session);
      if (!order) throw httpError("Order not found", 404);
      if (!validOrderTransitions[order.status].includes(status)) {
        throw httpError(`Cannot change order from ${order.status} to ${status}`, 409);
      }

      if (status === "Cancelled") {
        for (const item of order.items) {
          const product = await Product.findById(item.product).session(session);
          if (!product) {
            throw httpError(`Product ${item.sku} is no longer available`, 409);
          }
          const quantityAfter = product.stock + item.quantity;
          if (!Number.isSafeInteger(quantityAfter)) {
            throw httpError(`Restoring stock for ${item.sku} exceeds the supported limit`, 409);
          }
          const updated = await Product.findOneAndUpdate(
            { _id: item.product, stock: product.stock },
            { $inc: { stock: item.quantity } },
            { returnDocument: "after", session, runValidators: true },
          );
          if (!updated) throw httpError("Stock changed; retry the cancellation", 409);
          await InventoryMovement.create(
            [
              {
                product: item.product,
                change: item.quantity,
                quantityBefore: updated.stock - item.quantity,
                quantityAfter: updated.stock,
                reason: `Cancellation of ${order.orderNumber}`,
                type: "cancellation",
                performedBy: req.user.id,
                order: order._id,
              },
            ],
            { session },
          );
        }
      }

      order.status = status;
      order.statusHistory.push({
        status,
        changedBy: req.user.id,
        note: note.trim(),
      });
      await order.save({ session });
      orderId = order._id;
    });
  } finally {
    await session.endSession();
  }

  const order = await Order.findById(orderId)
    .populate("customer", "name email phone address")
    .populate("createdBy", "name email")
    .populate("statusHistory.changedBy", "name email");
  return res.json({ success: true, message: "Order status updated", order });
}

export async function getOrderHistory(req, res) {
  return getOrder(req, res);
}