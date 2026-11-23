import { Router } from "express";
import {
  createCustomer,
  deleteCustomer,
  getCustomer,
  getCustomerOrders,
  getCustomers,
  updateCustomer,
} from "../controller/customer.controller.js";
import { verifyJWT } from "../middleware/Auth.middleware.js";

const router = Router();

router.use(verifyJWT);
router.get("/", getCustomers);
router.post("/", createCustomer);
router.get("/:id/orders", getCustomerOrders);
router.get("/:id", getCustomer);
router.patch("/:id", updateCustomer);
router.delete("/:id", deleteCustomer);

export default router;