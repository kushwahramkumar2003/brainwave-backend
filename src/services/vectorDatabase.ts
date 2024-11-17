import { Pinecone } from "@pinecone-database/pinecone";
import config from "../config";

const pinecone = new Pinecone({
  apiKey: config.PINECONE_API_KEY,
});

export async function initVectorDB() {
  return pinecone;
}

export async function searchVectorDatabase(
  queryEmbedding: number[],
  userId: string,
  topK: number = 5
) {
  const index = pinecone.index(config.PINECONE_INDEX_NAME);

  const queryResponse = await index.query({
    vector: queryEmbedding,
    topK,
    filter: { userId },
    includeMetadata: true,
  });

  return queryResponse.matches?.map((match) => ({
    id: match.id,
    score: match.score,
    metadata: match.metadata,
  }));
}

export async function storeVectorEmbedding(
  id: string,
  vector: number[],
  metadata: Record<string, any>
) {
  const index = pinecone.index(config.PINECONE_INDEX_NAME);

  await index.upsert([
    {
      id,
      values: vector,
      metadata,
    },
  ]);
}
