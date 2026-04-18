import express from "express";
import {
  getAllUsers,
  getUserStats,
  updateUserStatus,
  getSecuritySummaryForUser,
  uploadEncryptionPublicKey,
  getEncryptionPublicKey,
} from "../controllers/userController.js";
import { protect } from "../middleware/auth.js";

const router = express.Router();

router.use(protect);

router.get("/", getAllUsers);
router.get("/stats", getUserStats);
router.get("/me/security-summary", getSecuritySummaryForUser);
router.put("/status", updateUserStatus);

// E2EE public key exchange
router.post("/me/encryption-key", uploadEncryptionPublicKey);
router.get("/:userId/encryption-key", getEncryptionPublicKey);

export default router;
