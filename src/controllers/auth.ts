import { Request, Response, NextFunction, CookieOptions } from "express";
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

    const options: CookieOptions = {
      expires: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
      httpOnly: true,
      sameSite: "none",
      secure: true,
    };

    res.cookie("token", token, options);

    res.status(200).json({
      message: "User logged in successfully",
    });
  } catch (error) {
    next(error);
  }
};

export const authCheck = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    console.log(req.userId);
    const user = await User.findById(req.userId).select("username -_id");

    if (!user) {
      res.status(404).json({
        message: "User not found",
      });
      return;
    }

    res.status(200).json({
      message: "Access granted",
      user: {
        username: user.username,
        id: req.userId,
      },
    });
  } catch (error) {
    next(error);
  }
};
