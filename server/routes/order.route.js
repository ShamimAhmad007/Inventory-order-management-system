import { Router } from "express";
import {
  createOrder,
  getOrder,
  getOrderHistory,
  getOrders,
  updateOrderStatus,
} from "../controller/order.controller.js";
import { verifyJWT } from "../middleware/Auth.middleware.js";

const router = Router();

router.use(verifyJWT);
router.get("/", getOrders);
router.post("/", createOrder);
router.get("/:id/history", getOrderHistory);
router.get("/:id", getOrder);
router.patch("/:id/status", updateOrderStatus);

export default router;