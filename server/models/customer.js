import mongoose from "mongoose";

const customerSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 150 },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      maxlength: 254,
      default: undefined,
    },
    phone: {
      type: String,
      trim: true,
      maxlength: 40,
      default: undefined,
    },
    address: { type: String, trim: true, maxlength: 500, default: "" },
    orderCount: { type: Number, min: 0, default: 0, select: false },
  },
  { timestamps: true },
);

customerSchema.index(
  { email: 1 },
  { unique: true, partialFilterExpression: { email: { $type: "string" } } },
);
customerSchema.index(
  { phone: 1 },
  { unique: true, partialFilterExpression: { phone: { $type: "string" } } },
);

const Customer = mongoose.model("Customer", customerSchema);
export default Customer;