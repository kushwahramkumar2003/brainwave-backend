import { z } from "zod";

export const SignupSchema = z.object({
  body: z.object({
    username: z.string().min(4),
    password: z.string().min(8),
  }),
});

export const LoginSchema = z.object({
  body: z.object({
    username: z.string(),
    password: z.string(),
  }),
});
