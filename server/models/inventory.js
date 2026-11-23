import mongoose from "mongoose";

const inventoryMovementSchema = new mongoose.Schema(
  {
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
      index: true,
    },
    change: {
      type: Number,
      required: true,
      validate: {
        validator: (value) => Number.isInteger(value) && value !== 0,
        message: "Inventory change must be a non-zero whole number",
      },
    },
    quantityBefore: { type: Number, required: true, min: 0 },
    quantityAfter: { type: Number, required: true, min: 0 },
    reason: { type: String, required: true, trim: true, maxlength: 300 },
    type: {
      type: String,
      enum: ["adjustment", "order", "cancellation"],
      required: true,
    },
    performedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    order: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      default: null,
    },
  },
  { timestamps: true },
);

inventoryMovementSchema.index({ owner: 1, createdAt: -1, _id: -1 });

const InventoryMovement = mongoose.model(
  "InventoryMovement",
  inventoryMovementSchema,
);
export default InventoryMovement;