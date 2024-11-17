import * as tf from "@tensorflow/tfjs";
import * as use from "@tensorflow-models/universal-sentence-encoder";

interface EmbeddingMetadata {
  userId: string;
  type: string;
  text: string;
}

let embeddingModel: use.UniversalSentenceEncoder | null = null;
const EMBEDDING_DIMENSION = 512;

export async function generateEmbedding(text: string): Promise<number[]> {
  try {
    if (!embeddingModel) {
      embeddingModel = await use.load();
    }

    const cleanedText = text.replace(/\s+/g, " ").trim().slice(0, 8192);

    const embeddings = await embeddingModel.embed(cleanedText);

    const embeddingArray = await embeddings.array();
    const embedding = embeddingArray[0];

    const normalizedEmbedding = await tf.tidy(() => {
      const tensor = tf.tensor(embedding);
      const normalized = tf.div(tensor, tf.norm(tensor));
      return normalized.arraySync() as number[];
    });

    if (normalizedEmbedding.length !== EMBEDDING_DIMENSION) {
      throw new Error(
        `Invalid embedding dimension: ${normalizedEmbedding.length}`
      );
    }

    return normalizedEmbedding;
  } catch (error) {
    console.error("Error generating embedding:", error);
    return new Array(EMBEDDING_DIMENSION).fill(0);
  }
}

export async function initializeModel(): Promise<void> {
  try {
    if (!embeddingModel) {
      embeddingModel = await use.load();
      console.log("Model loaded successfully");
    }
  } catch (error) {
    console.error("Error initializing model:", error);
    throw error;
  }
}

export async function generateEmbeddingBatch(
  texts: string[]
): Promise<number[][]> {
  try {
    if (!embeddingModel) {
      await initializeModel();
    }

    const cleanedTexts = texts.map((text) =>
      text.replace(/\s+/g, " ").trim().slice(0, 8192)
    );

    const embeddings = await embeddingModel!.embed(cleanedTexts);

    const embeddingArrays = await embeddings.array();

    const normalizedEmbeddings = await tf.tidy(() => {
      const tensors = tf.tensor2d(embeddingArrays);
      const norms = tf.norm(tensors, 2, 1, true);
      const normalized = tf.div(tensors, norms);
      return normalized.arraySync() as number[][];
    });

    if (
      normalizedEmbeddings.some((emb) => emb.length !== EMBEDDING_DIMENSION)
    ) {
      throw new Error("Invalid embedding dimensions in batch");
    }

    return normalizedEmbeddings;
  } catch (error) {
    console.error("Error generating batch embeddings:", error);
    return Array(texts.length).fill(new Array(EMBEDDING_DIMENSION).fill(0));
  }
}
