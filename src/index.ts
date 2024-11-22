import express, { Response, Request } from "express";
import connectDb from "./utils/connectDB";
import router from "./routes";
import { errorHandler } from "./middleware/errorHandler";
import { initVectorDB } from "./services/vectorDatabase";
import config from "./config";
import cors from "cors";
import cookieParser from "cookie-parser";

const app = express();

const allowedOrigins = [
  "http://localhost:5173",
  "https://brainwave-web-app.vercel.app",
];

app.use(
  cors({
    origin: function (origin, callback) {
      const isAllowed = allowedOrigins.includes(origin!) || !origin;
      callback(null, isAllowed);
    },
    credentials: true,
    exposedHeaders: [
      "set-cookie",
      "Content-Disposition",
      "Content-Type",
      "Content-Length",
    ],
  })
);
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use("/api/v1", router);
app.use("/health", (req: Request, res: Response) => {
  res.json({
    status: "ok",
    message: "Server is running",
  });
});

//@ts-ignore
app.use(errorHandler);

const startServer = async () => {
  try {
    await connectDb();
    await initVectorDB();
    app.listen(config.PORT, () => {
      console.log(`Server started on port ${config.PORT}`);
    });
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
};

startServer();
