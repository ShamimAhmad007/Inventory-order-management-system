import { Router } from "express";
import {
  createCategory,
  deleteCategory,
  getCategories,
  updateCategory,
} from "../controller/category.controller.js";
import { verifyJWT } from "../middleware/Auth.middleware.js";

const router = Router();

router.use(verifyJWT);
router.get("/", getCategories);
router.post("/", createCategory);
router.patch("/:id", updateCategory);
router.delete("/:id", deleteCategory);

export default router;