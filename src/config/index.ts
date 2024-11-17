import dotenv from "dotenv";
dotenv.config();

const config = {
  PORT: process.env.PORT || 5000,
  MONGO_URI: process.env.MONGO_URI || "",
  JWT_SECRET: process.env.JWT_SECRET || "",
  OPENAI_API_KEY: process.env.OPENAI_API_KEY || "",
  PINECONE_API_KEY: process.env.PINECONE_API_KEY || "",
  PINECONE_ENVIRONMENT: process.env.PINECONE_ENVIRONMENT || "",
  PINECONE_INDEX_NAME: process.env.PINECONE_INDEX_NAME || "",
  REDIS_URL: process.env.REDIS_URL || "",
  ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY || "",
};

export default config;
