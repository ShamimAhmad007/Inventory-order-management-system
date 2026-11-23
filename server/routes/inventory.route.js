import { Router } from "express";
import {
  adjustStock,
  getInventoryMovements,
  getInventorySummary,
  getLowStockProducts,
  getOutOfStockProducts,
} from "../controller/inventory.controller.js";
import { verifyJWT } from "../middleware/Auth.middleware.js";

const router = Router();

router.use(verifyJWT);
router.get("/", getInventorySummary);
router.get("/low-stock", getLowStockProducts);
router.get("/out-of-stock", getOutOfStockProducts);
router.get("/movements", getInventoryMovements);
router.patch("/:productId/adjust", adjustStock);

export default router;