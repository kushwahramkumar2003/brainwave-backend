import { Request, Response, NextFunction } from "express";
import User from "../models/User";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import config from "../config";
import { LoginSchema, SignupSchema } from "../schemas/auth";
import { CustomError } from "../utils/customError";

export const signup = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { username, password } = SignupSchema.parse(req).body;

    const existingUser = await User.findOne({ username });
    if (existingUser) {
      throw new CustomError("User already exists", 403);
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = new User({
      username,
      password: hashedPassword,
    });

    await newUser.save();

    res.status(201).json({
      message: "User created successfully",
    });
  } catch (error) {
    next(error);
  }
};

export const login = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { username, password } = LoginSchema.parse(req).body;

    const user = await User.findOne({ username });
    if (!user) {
      throw new CustomError("User not found", 404);
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      throw new CustomError("Invalid credentials", 401);
    }

    const token = jwt.sign({ userId: user._id }, config.JWT_SECRET, {
      expiresIn: "1d",
    });

    res.status(200).json({
      message: "User logged in successfully",
      token,
    });
  } catch (error) {
    next(error);
  }
};