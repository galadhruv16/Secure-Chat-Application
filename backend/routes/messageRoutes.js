import express from "express";
import {
  sendMessage,
  getMessages,
  markAsRead,
} from "../controllers/messageController.js";
import { protect } from "../middleware/auth.js";

const router = express.Router();

router.use(protect);

router.post("/send", sendMessage);
router.get("/:userId", getMessages);
router.patch("/:messageId/read", markAsRead);

export default router;
