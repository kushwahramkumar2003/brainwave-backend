import express, { Response, Request } from "express";
import connectDb from "./utils/connectDB";
import router from "./routes";
import { errorHandler } from "./middleware/errorHandler";
import { initVectorDB } from "./services/vectorDatabase";
import config from "./config";

const app = express();

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
