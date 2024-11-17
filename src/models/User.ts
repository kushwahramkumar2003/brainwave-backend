import { Schema, model, Document } from "mongoose";
import { z } from "zod";

const UserSchema = z.object({
  username: z.string().min(4),
  password: z.string().min(8),
});

export type UserType = z.infer<typeof UserSchema>;

interface UserDocument extends UserType, Document {}

const UserModel = new Schema<UserDocument>({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
});

const User = model<UserDocument>("User", UserModel);
export default User;
