import express from "express";
import { register, login, logout, logoutAll, refresh } from "../controllers/authController.js";
import { protect } from "../middleware/auth.js";
import { loginLimiter, refreshLimiter } from "../middleware/rateLimit.js";

const router = express.Router();

router.post("/register", register);
router.post("/login", loginLimiter, login);
router.post("/refresh", refreshLimiter, refresh);
router.post("/logout", protect, logout);
router.post("/logout-all", protect, logoutAll);

export default router;
