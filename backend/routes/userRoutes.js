import express from "express";
import {
  getAllUsers,
  getUserStats,
  updateUserStatus,
} from "../controllers/userController.js";
import { protect } from "../middleware/auth.js";

const router = express.Router();

router.use(protect);

router.get("/", getAllUsers);
router.get("/stats", getUserStats);
router.put("/status", updateUserStatus);

export default router;
