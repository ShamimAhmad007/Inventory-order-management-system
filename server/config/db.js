import mongoose from "mongoose";

export async function run() {
  const uri = process.env.DB;
  if (!uri) {
    throw new Error("DB is not configured");
  }

  await mongoose.connect(uri);
  console.log("Connected to MongoDB");
}
