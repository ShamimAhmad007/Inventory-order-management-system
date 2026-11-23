import { Router } from "express";
import { login, logout, register } from "../controller/auth.controller.js";
import { verifyJWT } from "../middleware/Auth.middleware.js";

const router = Router();

router.post("/register", register);
router.post("/login", login);
router.post("/logout", verifyJWT, logout);

export default router;