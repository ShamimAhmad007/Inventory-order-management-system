import mongoose from "mongoose";
import InventoryMovement from "../models/inventory.js";
import Product from "../models/product.js";

const pageSettings = (query) => {
  const page = Math.max(Number.parseInt(query.page, 10) || 1, 1);
  const limit = Math.min(
    Math.max(Number.parseInt(query.limit, 10) || 20, 1),
    100,
  );
  return { page, limit };
};

function getLowStockThreshold() {
  const configured = Number.parseInt(process.env.LOW_STOCK_THRESHOLD, 10);
  return Number.isInteger(configured) && configured >= 0 ? configured : 5;
}

function httpError(message, status) {
  return Object.assign(new Error(message), { status });
}

function inventoryAccessFilter(user) {
  return { owner: user.id };
}

export async function getInventorySummary(req, res) {
  const threshold = getLowStockThreshold();
  const accessFilter = { ...inventoryAccessFilter(req.user), archivedAt: null };
  const [totalProducts, lowStockCount, outOfStockCount] = await Promise.all([
    Product.countDocuments(accessFilter),
    Product.countDocuments({ ...accessFilter, stock: { $gt: 0, $lte: threshold } }),
    Product.countDocuments({ ...accessFilter, stock: 0 }),
  ]);
  return res.json({ success: true, threshold, totalProducts, lowStockCount, outOfStockCount });
}

export async function getLowStockProducts(req, res) {
  const { page, limit } = pageSettings(req.query);
  const threshold = getLowStockThreshold();
  const filter = {
    ...inventoryAccessFilter(req.user),
    archivedAt: null,
    stock: { $gt: 0, $lte: threshold },
  };
  const [products, total] = await Promise.all([
    Product.find(filter)
      .populate({
        path: "category",
        match: { owner: req.user.id },
        select: "name",
      })
      .sort({ stock: 1, name: 1 })
      .skip((page - 1) * limit)
      .limit(limit),
    Product.countDocuments(filter),
  ]);
  return res.json({
    success: true,
    threshold,
    products,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  });
}

export async function getOutOfStockProducts(req, res) {
  const { page, limit } = pageSettings(req.query);
  const filter = {
    ...inventoryAccessFilter(req.user),
    archivedAt: null,
    stock: 0,
  };
  const [products, total] = await Promise.all([
    Product.find(filter)
      .populate({
        path: "category",
        match: { owner: req.user.id },
        select: "name",
      })
      .sort({ name: 1 })
      .skip((page - 1) * limit)
      .limit(limit),
    Product.countDocuments(filter),
  ]);
  return res.json({
    success: true,
    products,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  });
}

export async function getInventoryMovements(req, res) {
  const { page, limit } = pageSettings(req.query);
  const filter = { owner: req.user.id };
  if (req.query.productId !== undefined) {
    if (!mongoose.isValidObjectId(req.query.productId)) {
      return res.status(400).json({ success: false, message: "Invalid product id" });
    }
    filter.product = new mongoose.Types.ObjectId(req.query.productId);
  }
  if (req.query.type !== undefined) {
    if (!["adjustment", "order", "cancellation"].includes(req.query.type)) {
      return res.status(400).json({ success: false, message: "Invalid movement type" });
    }
    filter.type = req.query.type;
  }

  const [movements, total] = await Promise.all([
    InventoryMovement.find(filter)
      .populate({
        path: "product",
        match: { owner: req.user.id },
        select: "name sku",
      })
      .populate({
        path: "performedBy",
        match: { _id: req.user.id },
        select: "name email",
      })
      .populate({
        path: "order",
        match: { createdBy: req.user.id },
        select: "orderNumber",
      })
      .sort({ createdAt: -1, _id: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    InventoryMovement.countDocuments(filter),
  ]);
  return res.json({
    success: true,
    movements,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  });
}

export async function adjustStock(req, res) {
  if (!mongoose.isValidObjectId(req.params.productId)) {
    return res.status(400).json({ success: false, message: "Invalid product id" });
  }
  const { change, reason } = req.body ?? {};
  if (!Number.isInteger(change) || change === 0) {
    return res.status(400).json({
      success: false,
      message: "Stock change must be a non-zero whole number",
    });
  }
  if (typeof reason !== "string" || !reason.trim() || reason.trim().length > 300) {
    return res.status(400).json({
      success: false,
      message: "Provide a reason of at most 300 characters",
    });
  }

  const session = await mongoose.startSession();
  let result;
  try {
    await session.withTransaction(async () => {
      const accessFilter = inventoryAccessFilter(req.user);
      const product = await Product.findOne({
        _id: req.params.productId,
        ...accessFilter,
        archivedAt: null,
      }).session(session);
      if (!product) throw httpError("Product not found", 404);

      const quantityAfter = product.stock + change;
      if (!Number.isSafeInteger(quantityAfter) || quantityAfter < 0) {
        throw httpError("Stock cannot become negative or exceed the safe limit", 409);
      }
      const updated = await Product.findOneAndUpdate(
        { _id: product._id, ...accessFilter, stock: product.stock, archivedAt: null },
        { $inc: { stock: change } },
        { returnDocument: "after", session, runValidators: true },
      );
      if (!updated) throw httpError("Stock changed; retry the adjustment", 409);

      const [movement] = await InventoryMovement.create(
        [
          {
            product: product._id,
            owner: req.user.id,
            change,
            quantityBefore: product.stock,
            quantityAfter: updated.stock,
            reason: reason.trim(),
            type: "adjustment",
            performedBy: req.user.id,
          },
        ],
        { session },
      );
      result = { product: updated, movement };
    });
  } finally {
    await session.endSession();
  }

  return res.json({ success: true, message: "Inventory updated", ...result });
}