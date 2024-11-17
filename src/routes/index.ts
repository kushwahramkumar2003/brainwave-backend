import express from "express";
import { login, signup } from "../controllers/auth";
import { authMiddleware } from "../middleware";
import {
  addNewContent,
  createOrDisableSharableLink,
  deleteUserContent,
  getAllUserContent,
  getUserBrainByShareLink,
} from "../controllers/content";
import { validateRequest } from "../middleware/validateRequest";
import { LoginSchema, SignupSchema } from "../schemas/auth";
import {
  AddContentSchema,
  DeleteContentSchema,
  ShareLinkSchema,
} from "../schemas/content";

const router = express.Router();

router.post("/signup", validateRequest(SignupSchema), signup);
router.post("/signin", validateRequest(LoginSchema), login);
router.post(
  "/content",
  authMiddleware,
  validateRequest(AddContentSchema),
  addNewContent
);
router.get("/content", authMiddleware, getAllUserContent);
router.delete(
  "/content",
  authMiddleware,
  validateRequest(DeleteContentSchema),
  deleteUserContent
);
router.post(
  "/brain/share",
  authMiddleware,
  validateRequest(ShareLinkSchema),
  createOrDisableSharableLink
);
router.get("/brain/:shareLink", getUserBrainByShareLink);

export default router;
