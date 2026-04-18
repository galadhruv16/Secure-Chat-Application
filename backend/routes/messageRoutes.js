import express from "express";
import {
  sendMessage,
  getMessages,
  markAsRead,
} from "../controllers/messageController.js";
import { protect } from "../middleware/auth.js";
import { messageSendLimiter } from "../middleware/rateLimit.js";

const router = express.Router();

router.use(protect);

router.post("/send", messageSendLimiter, sendMessage);
router.get("/:userId", getMessages);
router.patch("/:messageId/read", markAsRead);

export default router;
