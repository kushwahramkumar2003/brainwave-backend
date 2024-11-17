import mongoose from "mongoose";
import config from "../config/index";

const connectDb = async () => {
  try {
    const conn = await mongoose.connect(config.MONGO_URI);
    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.log(error);
  }
};

export default connectDb;
