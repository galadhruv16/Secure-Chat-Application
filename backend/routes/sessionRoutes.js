import express from "express";
import {
  listSessions,
  revokeOneSession,
  revokeAllOtherSessions,
} from "../controllers/sessionController.js";
import { protect } from "../middleware/auth.js";

const router = express.Router();

router.use(protect);

router.get("/", listSessions);
router.delete("/revoke-others", revokeAllOtherSessions);
router.delete("/:sessionId", revokeOneSession);

export default router;
