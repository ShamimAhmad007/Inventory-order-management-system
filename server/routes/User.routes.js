import { Router } from "express";
import { getProfile, updateProfile } from "../controller/User.controller.js";
import { verifyJWT } from "../middleware/Auth.middleware.js";

const router = Router();

router.use(verifyJWT);
router.get("/me", getProfile);
router.patch("/me", updateProfile);

export default router;