import mongoose from "mongoose";
import Category from "../models/category.js";
import Product from "../models/product.js";

const allowedSorts = {
  name: "name",
  price: "price",
  quantity: "stock",
};

export function productAccessFilter(user) {
  return { owner: user.id };
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function validProductFields(body) {
  const fields = {};
  const { name, description, imageUrl, sku, category, price, stock } = body;

  if (name !== undefined) {
    if (typeof name !== "string" || !name.trim()) return null;
    fields.name = name.trim();
  }
  if (description !== undefined) {
    if (typeof description !== "string") return null;
    fields.description = description.trim();
  }
  if (imageUrl !== undefined) {
    if (typeof imageUrl !== "string") return null;
    fields.imageUrl = imageUrl.trim();
  }
  if (sku !== undefined) {
    if (typeof sku !== "string" || !sku.trim()) return null;
    fields.sku = sku.trim().toUpperCase();
  }
  if (category !== undefined) {
    if (!mongoose.isValidObjectId(category)) return null;
    fields.category = category;
  }
  if (price !== undefined) {
    if (typeof price !== "number" || !Number.isFinite(price) || price < 0) {
      return null;
    }
    fields.price = price;
  }
  if (stock !== undefined) {
    if (!Number.isInteger(stock) || stock < 0) return null;
    fields.stock = stock;
  }

  return fields;
}

export async function getProducts(req, res) {
  const page = Math.max(Number.parseInt(req.query.page, 10) || 1, 1);
  const limit = Math.min(Math.max(Number.parseInt(req.query.limit, 10) || 10, 1), 100);
  const filter = {
    ...productAccessFilter(req.user),
    archivedAt: null,
  };
  const search = typeof req.query.search === "string" ? req.query.search.trim() : "";
  const category = req.query.category;
  const stockStatus = req.query.stockStatus;

  if (search) {
    const expression = new RegExp(escapeRegex(search), "i");
    filter.$or = [{ name: expression }, { sku: expression }];
  }
  if (category !== undefined) {
    if (!mongoose.isValidObjectId(category)) {
      return res.status(400).json({ success: false, message: "Invalid category id" });
    }
    filter.category = category;
  }
  if (stockStatus === "in_stock") filter.stock = { $gt: 0 };
  else if (stockStatus === "out_of_stock") filter.stock = 0;
  else if (stockStatus !== undefined) {
    return res.status(400).json({
      success: false,
      message: "stockStatus must be in_stock or out_of_stock",
    });
  }

  const sortField = allowedSorts[req.query.sortBy] ?? "name";
  const sortOrder = req.query.sortOrder === "desc" ? -1 : 1;
  const productQuery = Product.find(filter).populate({
    path: "category",
    match: { owner: req.user.id },
    select: "name",
  });
  const [products, total] = await Promise.all([
    productQuery
      .sort({ [sortField]: sortOrder, _id: 1 })
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

export async function getProduct(req, res) {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(400).json({ success: false, message: "Invalid product id" });
  }
  const filter = {
    _id: req.params.id,
    ...productAccessFilter(req.user),
    archivedAt: null,
  };
  const product = await Product.findOne(filter).populate({
    path: "category",
    match: { owner: req.user.id },
    select: "name",
  });
  if (!product) {
    return res.status(404).json({ success: false, message: "Product not found" });
  }
  return res.json({ success: true, product });
}

export async function createProduct(req, res) {
  const fields = validProductFields(req.body ?? {});
  if (
    !fields ||
    !fields.name ||
    !fields.sku ||
    fields.price === undefined
  ) {
    return res.status(400).json({
      success: false,
      message: "Provide a name, SKU, non-negative price, and valid product fields",
    });
  }
  if (fields.stock > 0) {
    return res.status(400).json({
      success: false,
      message: "Create the product with zero stock, then use inventory adjustment to add stock",
    });
  }
  if (
    fields.category &&
    !(await Category.exists({ _id: fields.category, owner: req.user.id }))
  ) {
    return res.status(400).json({ success: false, message: "Category not found" });
  }

  const product = await Product.create({ ...fields, owner: req.user.id });
  return res.status(201).json({ success: true, message: "Product created", product });
}

export async function updateProduct(req, res) {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(400).json({ success: false, message: "Invalid product id" });
  }
  if (req.body?.stock !== undefined) {
    return res.status(400).json({
      success: false,
      message: "Use the inventory adjustment endpoint to change stock",
    });
  }
  const fields = validProductFields(req.body ?? {});
  if (!fields || Object.keys(fields).length === 0) {
    return res.status(400).json({ success: false, message: "Provide valid product fields to update" });
  }
  if (
    fields.category &&
    !(await Category.exists({ _id: fields.category, owner: req.user.id }))
  ) {
    return res.status(400).json({ success: false, message: "Category not found" });
  }

  const product = await Product.findOneAndUpdate(
    {
      _id: req.params.id,
      ...productAccessFilter(req.user),
      archivedAt: null,
    },
    { $set: fields },
    { returnDocument: "after", runValidators: true },
  ).populate({
    path: "category",
    match: { owner: req.user.id },
    select: "name",
  });
  if (!product) {
    return res.status(404).json({ success: false, message: "Product not found" });
  }
  return res.json({ success: true, message: "Product updated", product });
}

export async function deleteProduct(req, res) {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(400).json({ success: false, message: "Invalid product id" });
  }
  const product = await Product.findOneAndUpdate(
    {
      _id: req.params.id,
      ...productAccessFilter(req.user),
      archivedAt: null,
    },
    { $set: { archivedAt: new Date() } },
    { returnDocument: "after" },
  );
  if (!product) {
    return res.status(404).json({ success: false, message: "Product not found" });
  }
  return res.json({ success: true, message: "Product removed from inventory", product });
}