import { Router } from "express";
import { getDashboardSummary } from "../controller/dashboard.controller.js";
import { verifyJWT } from "../middleware/Auth.middleware.js";

const router = Router();

router.get("/", verifyJWT, getDashboardSummary);

export default router;
