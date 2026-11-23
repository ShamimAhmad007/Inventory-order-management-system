import mongoose from "mongoose";
import Customer from "../models/customer.js";
import Order from "../models/order.js";

function pageSettings(query) {
  const page = Math.max(Number.parseInt(query.page, 10) || 1, 1);
  const limit = Math.min(
    Math.max(Number.parseInt(query.limit, 10) || 20, 1),
    100,
  );
  return { page, limit };
}

export function customerOrderFilter(customerId) {
  return { customer: customerId };
}

function normalizeCustomerInput(body, { partial = false } = {}) {
  const fields = {};
  for (const field of ["name", "email", "phone", "address"]) {
    if (body[field] === undefined) continue;
    if (typeof body[field] !== "string") return null;
    const value = body[field].trim();
    if (field === "name" && !value) return null;
    if (field === "email" && value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      return null;
    }
    if (field === "email") fields.email = value ? value.toLowerCase() : undefined;
    else if (field === "phone") {
      fields.phone = value ? value.replace(/[()\s.-]/g, "") : undefined;
    }
    else fields[field] = value;
  }

  if (!partial) {
    if (!fields.name || (!fields.email && !fields.phone)) return null;
    fields.address ??= "";
  }
  return fields;
}

async function contactAlreadyExists(fields, exceptId) {
  const conditions = [];
  if (fields.email) conditions.push({ email: fields.email });
  if (fields.phone) conditions.push({ phone: fields.phone });
  if (conditions.length === 0) return false;
  return Boolean(
    await Customer.exists({
      ...(exceptId ? { _id: { $ne: exceptId } } : {}),
      $or: conditions,
    }),
  );
}

export async function getCustomers(req, res) {
  const { page, limit } = pageSettings(req.query);
  const filter = {};
  if (typeof req.query.search === "string" && req.query.search.trim()) {
    const escaped = req.query.search.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const search = new RegExp(escaped, "i");
    filter.$or = [{ name: search }, { email: search }, { phone: search }];
  }
  const [customers, total] = await Promise.all([
    Customer.find(filter)
      .sort({ name: 1, _id: 1 })
      .skip((page - 1) * limit)
      .limit(limit),
    Customer.countDocuments(filter),
  ]);
  return res.json({
    success: true,
    customers,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  });
}

export async function createCustomer(req, res) {
  const fields = normalizeCustomerInput(req.body ?? {});
  if (!fields) {
    return res.status(400).json({
      success: false,
      message: "Provide a name and at least one valid contact method (email or phone)",
    });
  }
  if (await contactAlreadyExists(fields)) {
    return res.status(409).json({
      success: false,
      message: "A customer with that email or phone already exists",
    });
  }
  const customer = await Customer.create(fields);
  return res.status(201).json({ success: true, message: "Customer created", customer });
}

export async function getCustomer(req, res) {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(400).json({ success: false, message: "Invalid customer id" });
  }
  const customer = await Customer.findById(req.params.id);
  if (!customer) {
    return res.status(404).json({ success: false, message: "Customer not found" });
  }
  return res.json({ success: true, customer });
}

export async function updateCustomer(req, res) {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(400).json({ success: false, message: "Invalid customer id" });
  }
  const fields = normalizeCustomerInput(req.body ?? {}, { partial: true });
  if (!fields || Object.keys(fields).length === 0) {
    return res.status(400).json({ success: false, message: "Provide valid customer fields" });
  }
  const existing = await Customer.findById(req.params.id);
  if (!existing) {
    return res.status(404).json({ success: false, message: "Customer not found" });
  }
  const mergedContact = {
    email: Object.hasOwn(req.body, "email") ? fields.email : existing.email,
    phone: Object.hasOwn(req.body, "phone") ? fields.phone : existing.phone,
  };
  if (!mergedContact.email && !mergedContact.phone) {
    return res.status(400).json({
      success: false,
      message: "A customer must have at least one contact method",
    });
  }
  if (await contactAlreadyExists(fields, req.params.id)) {
    return res.status(409).json({
      success: false,
      message: "A customer with that email or phone already exists",
    });
  }
  Object.assign(existing, fields);
  const customer = await existing.save();
  return res.json({ success: true, message: "Customer updated", customer });
}

export async function deleteCustomer(req, res) {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(400).json({ success: false, message: "Invalid customer id" });
  }
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const customer = await Customer.findById(req.params.id).session(session);
      if (!customer) {
        const error = new Error("Customer not found");
        error.status = 404;
        throw error;
      }
      if (await Order.exists({ customer: req.params.id }).session(session)) {
        const error = new Error("Cannot delete a customer with order history");
        error.status = 409;
        throw error;
      }
      await Customer.deleteOne({ _id: req.params.id }, { session });
    });
  } finally {
    await session.endSession();
  }
  return res.json({ success: true, message: "Customer deleted" });
}

export async function getCustomerOrders(req, res) {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(400).json({ success: false, message: "Invalid customer id" });
  }
  if (!(await Customer.exists({ _id: req.params.id }))) {
    return res.status(404).json({ success: false, message: "Customer not found" });
  }
  const { page, limit } = pageSettings(req.query);
  const orderFilter = customerOrderFilter(req.params.id);
  const [orders, total] = await Promise.all([
    Order.find(orderFilter)
      .populate("createdBy", "name email")
      .sort({ createdAt: -1, _id: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    Order.countDocuments(orderFilter),
  ]);
  return res.json({
    success: true,
    orders,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  });
}