import express from "express";
import {
  getSecurityEvents,
  getSecurityOverview,
  getAuditLogs,
  resolveSecurityEvent,
} from "../controllers/securityController.js";
import { protect } from "../middleware/auth.js";

const router = express.Router();

router.use(protect);

router.get("/events", getSecurityEvents);
router.get("/summary", getSecurityOverview);
router.get("/audit-logs", getAuditLogs);
router.patch("/events/:eventId/resolve", resolveSecurityEvent);

export default router;
