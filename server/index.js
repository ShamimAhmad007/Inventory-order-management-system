import "dotenv/config";
import express from "express";
import cors from "cors";
import corsOptions from "./config/cors.js";
import { run } from "./config/db.js";
import authRoutes from "./routes/auth.route.js";
import userRoutes from "./routes/User.routes.js";
import categoryRoutes from "./routes/category.route.js";
import productRoutes from "./routes/product.route.js";
import inventoryRoutes from "./routes/inventory.route.js";
import orderRoutes from "./routes/order.route.js";
import customerRoutes from "./routes/customer.route.js";
import dashboardRoutes from "./routes/dashboard.route.js";
import { errorHandler, notFound } from "./middleware/error.middleware.js";

// const dotenv = require("dotenv");
// dotenv.config();

const app = express();
const port = Number(process.env.PORT) || 5000;

app.use(cors(corsOptions));
app.use(express.json({ limit: "1mb" }));

app.get("/", (req, res) => {
  res.json({ success: true, message: "Inventory & Order API is running" });
});

app.use("/auth", authRoutes);
app.use("/users", userRoutes);
app.use("/products", productRoutes);
app.use("/categories", categoryRoutes);
app.use("/inventory", inventoryRoutes);
app.use("/orders", orderRoutes);
app.use("/customers", customerRoutes);
app.use("/dashboard", dashboardRoutes);

app.use(notFound);
app.use(errorHandler);

async function startServer() {
  if (!process.env.JWT_SECRET) {
    throw new Error("JWT_SECRET is not configured");
  }
  await run();
  app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
  });
}

startServer().catch((error) => {
  console.error("Failed to start the server:", error);
  process.exitCode = 1;
});
