import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import config from "../config";
import { CustomError } from "../utils/customError";

export const authMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const token =
      req.cookies?.token || req.header("Authorization")?.replace("Bearer ", "");

    if (!token) {
      throw new CustomError("No token provided", 401);
    }

    const decoded = jwt.verify(token, config.JWT_SECRET as string) as {
      userId: string;
    };
    req.userId = decoded.userId;
    next();
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      next(new CustomError("Invalid token", 401));
    } else {
      next(error);
    }
  }
};
