import { Schema, model, Document, Types } from "mongoose";
import { z } from "zod";

const LinkSchema = z.object({
  hash: z.string(),
  userId: z.string(),
});

export type LinkType = z.infer<typeof LinkSchema>;

interface LinkDocument extends Omit<LinkType, "userId">, Document {
  userId: Types.ObjectId;
}

const LinkModel = new Schema<LinkDocument>({
  hash: { type: String, required: true },
  userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
});

const Link = model<LinkDocument>("Link", LinkModel);
export default Link;
