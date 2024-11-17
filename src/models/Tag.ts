import { Schema, model, Document } from "mongoose";
import { z } from "zod";

const TagSchema = z.object({
  title: z.string().min(1),
});

export type TagType = z.infer<typeof TagSchema>;

interface TagDocument extends TagType, Document {}

const TagModel = new Schema<TagDocument>({
  title: { type: String, required: true },
});

const Tag = model<TagDocument>("Tag", TagModel);
export default Tag;
