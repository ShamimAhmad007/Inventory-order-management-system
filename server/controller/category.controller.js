import mongoose from "mongoose";
import Category from "../models/category.js";
import Product from "../models/product.js";

export async function getCategories(req, res) {
  const categories = await Category.aggregate([
    {
      $lookup: {
        from: "products",
        localField: "_id",
        foreignField: "category",
        as: "products",
      },
    },
    {
      $project: {
        name: 1,
        description: 1,
        createdAt: 1,
        updatedAt: 1,
        productCount: { $size: "$products" },
      },
    },
    { $sort: { name: 1 } },
  ]);
  return res.json({ success: true, categories });
}

export async function createCategory(req, res) {
  const { name, description = "" } = req.body ?? {};
  if (
    typeof name !== "string" ||
    !name.trim() ||
    typeof description !== "string"
  ) {
    return res.status(400).json({
      success: false,
      message: "Provide a category name and valid description",
    });
  }
  const category = await Category.create({
    name: name.trim(),
    description: description.trim(),
  });
  return res.status(201).json({
    success: true,
    message: "Category created",
    category: { ...category.toObject(), productCount: 0 },
  });
}

export async function updateCategory(req, res) {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(400).json({ success: false, message: "Invalid category id" });
  }
  const { name, description } = req.body ?? {};
  const updates = {};
  if (name !== undefined) {
    if (typeof name !== "string" || !name.trim()) {
      return res.status(400).json({ success: false, message: "Name cannot be empty" });
    }
    updates.name = name.trim();
  }
  if (description !== undefined) {
    if (typeof description !== "string") {
      return res.status(400).json({ success: false, message: "Invalid description" });
    }
    updates.description = description.trim();
  }
  if (Object.keys(updates).length === 0) {
    return res.status(400).json({ success: false, message: "Provide fields to update" });
  }

  const category = await Category.findByIdAndUpdate(
    req.params.id,
    { $set: updates },
    { returnDocument: "after", runValidators: true },
  );
  if (!category) {
    return res.status(404).json({ success: false, message: "Category not found" });
  }
  const productCount = await Product.countDocuments({ category: category._id });
  return res.json({
    success: true,
    message: "Category updated",
    category: { ...category.toObject(), productCount },
  });
}

export async function deleteCategory(req, res) {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(400).json({ success: false, message: "Invalid category id" });
  }
  const category = await Category.findById(req.params.id);
  if (!category) {
    return res.status(404).json({ success: false, message: "Category not found" });
  }
  if (await Product.exists({ category: category._id })) {
    return res.status(409).json({
      success: false,
      message: "Cannot delete a category that has products",
    });
  }
  await category.deleteOne();
  return res.json({ success: true, message: "Category deleted" });
}