import { Schema, model, Document, Types } from "mongoose";
import { z } from "zod";

const ContentSchema = z.object({
  link: z.string().url(),
  type: z.enum(["document", "tweet", "youtube", "link"]),
  title: z.string().min(1),
  tags: z.array(z.string()),
  userId: z.string(),
});

export type ContentType = z.infer<typeof ContentSchema>;

interface ContentDocument
  extends Omit<ContentType, "tags" | "userId">,
    Document {
  tags: Types.ObjectId[];
  userId: Types.ObjectId;
}

const ContentModel = new Schema<ContentDocument>({
  link: { type: String, required: true },
  type: {
    type: String,
    enum: ["document", "tweet", "youtube", "link"],
    required: true,
  },
  title: { type: String, required: true },
  tags: [{ type: Schema.Types.ObjectId, ref: "Tag", required: true }], // Changed to Schema.Types.ObjectId
  userId: { type: Schema.Types.ObjectId, ref: "User", required: true }, // Changed to Schema.Types.ObjectId
});

const Content = model<ContentDocument>("Content", ContentModel);
export default Content;
