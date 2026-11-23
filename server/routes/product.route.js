import { Router } from "express";
import {
  createProduct,
  deleteProduct,
  getProduct,
  getProducts,
  updateProduct,
} from "../controller/product.controller.js";
import { verifyJWT } from "../middleware/Auth.middleware.js";

const router = Router();

router.use(verifyJWT);
router.get("/", getProducts);
router.get("/:id", getProduct);
router.post("/", createProduct);
router.patch("/:id", updateProduct);
router.delete("/:id", deleteProduct);

export default router;