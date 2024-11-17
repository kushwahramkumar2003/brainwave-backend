import { z } from "zod";

export const AddContentSchema = z.object({
  body: z.object({
    link: z.string().url(),
    type: z.enum(["document", "tweet", "youtube", "link"]),
    title: z.string().min(1),
    tags: z.array(z.string()),
  }),
});

export const DeleteContentSchema = z.object({
  body: z.object({
    contentId: z.string(),
  }),
});

export const ShareLinkSchema = z.object({
  body: z.object({
    share: z.boolean(),
  }),
});
