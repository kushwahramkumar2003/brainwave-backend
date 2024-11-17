import { Request, Response, NextFunction } from "express";
import Content from "../models/Content";
import Tag from "../models/Tag";
import Link from "../models/Link";
import User from "../models/User";
import crypto from "crypto";
import {
  AddContentSchema,
  DeleteContentSchema,
  ShareLinkSchema,
} from "../schemas/content";
import { CustomError } from "../utils/customError";
import {
  fetchTweetContent,
  fetchWebpageContent,
  fetchYoutubeTranscript,
} from "../services/fetchContent";
import { generateEmbedding } from "../services/embedding";
import {
  searchVectorDatabase,
  storeVectorEmbedding,
} from "../services/vectorDatabase";
import z from "zod";
import { cacheGet, cacheSet } from "../services/cache";
import { queryLLM } from "../services/llm";

const QuerySchema = z.object({
  query: z.string().min(1, "Query is required"),
});

export const addNewContent = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    console.log("Request body:", req.body);
    const { link, type, title, tags } = AddContentSchema.parse(req).body;

    const userId = req.userId;

    if (!userId) {
      throw new CustomError("User not authenticated", 401);
    }

    const tagIds = await Promise.all(
      tags.map(async (tagName) => {
        let tag = await Tag.findOne({ title: tagName.toLowerCase() });
        if (!tag) {
          tag = new Tag({ title: tagName.toLowerCase() });
          await tag.save();
        }
        return tag._id;
      })
    );

    console.log("Tag IDs:", tagIds);

    const content = new Content({
      link,
      type,
      title,
      tags: tagIds,
      userId,
    });

    await content.save();

    let textForEmbedding = "";
    switch (type) {
      case "tweet":
        textForEmbedding = await fetchTweetContent(link);
        break;
      case "youtube":
        textForEmbedding = await fetchYoutubeTranscript(link);
        break;
      case "document":
      case "link":
        textForEmbedding = await fetchWebpageContent(link);
        break;
    }

    console.log("Text for embedding:", textForEmbedding);

    const embedding = await generateEmbedding(textForEmbedding);

    console.log("Embedding:", embedding);

    // Store embedding in vector database
    await storeVectorEmbedding(content._id as string, embedding, {
      userId,
      type,
      text: textForEmbedding.substring(0, 1500), // Store first 1000 characters as metadata
    });

    const populatedContent = await Content.findById(content._id).populate(
      "tags"
    );

    res.status(201).json({
      message: "New content added successfully",
      content: populatedContent,
    });
  } catch (error) {
    next(error);
  }
};

export const getAllUserContent = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.userId;

    const userContent = await Content.find({ userId }).populate({
      path: "tags",
      select: "title",
    });

    const formattedContent = userContent.map((content) => ({
      id: content._id,
      type: content.type,
      link: content.link,
      title: content.title,
      tags: content.tags.map((tag: any) => tag.title),
    }));

    res.status(200).json({
      content: formattedContent,
    });
  } catch (error) {
    next(error);
  }
};

export const deleteUserContent = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.userId;
    const { contentId } = DeleteContentSchema.parse(req).body;

    const deleted = await Content.findOneAndDelete({
      userId,
      _id: contentId,
    });

    if (!deleted) {
      throw new CustomError("Content not found or unauthorized", 404);
    }

    res.status(200).json({
      message: "User content deleted successfully",
    });
  } catch (error) {
    next(error);
  }
};

export const createOrDisableSharableLink = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.userId;
    const { share } = ShareLinkSchema.parse(req).body;

    if (!share) {
      const result = await Link.findOneAndDelete({ userId });
      if (!result) {
        throw new CustomError("No sharable link found", 404);
      }
      res.status(200).json({
        message: "Sharable link deleted successfully",
      });
      return;
    }

    let shareLink = await Link.findOne({ userId });

    if (!shareLink) {
      const linkHash = crypto.randomUUID();
      shareLink = new Link({ userId, hash: linkHash });
      await shareLink.save();
    }

    res.status(200).json({
      link: shareLink.hash,
    });
  } catch (error) {
    next(error);
  }
};

export const getUserBrainByShareLink = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { shareLink } = req.params;

    const link = await Link.findOne({ hash: shareLink }).populate({
      path: "userId",
      select: "username",
      model: "User",
    });

    if (!link) {
      throw new CustomError("Share link not found or sharing is disabled", 404);
    }

    const contents = await Content.find({
      userId: (link.userId as any)._id,
    }).populate({
      path: "tags",
      select: "title",
    });

    const response = {
      username: (link.userId as any).username,
      content: contents.map((content) => ({
        id: content._id,
        type: content.type,
        link: content.link,
        title: content.title,
        tags: content.tags.map((tag: any) => tag.title),
      })),
    };

    res.status(200).json(response);
  } catch (error) {
    next(error);
  }
};

export const queryContent = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { query } = QuerySchema.parse(req.body);
    const userId = req.userId;

    if (!userId) {
      throw new CustomError("User not authenticated", 401);
    }

    const cachedResponse = await cacheGet(`query:${userId}:${query}`);
    if (cachedResponse) {
      res.status(200).json({ response: cachedResponse });
      return;
    }

    const queryEmbedding = await generateEmbedding(query);

    console.log("Query embedding:", queryEmbedding);

    const relevantContent = await searchVectorDatabase(queryEmbedding, userId);

    console.log("Relevant content:", relevantContent);

    //@ts-ignore
    const llmResponse = await queryLLM(query, relevantContent);

    console.log("LLM response:", llmResponse);

    await cacheSet(`query:${userId}:${query}`, llmResponse, 3600);

    res.status(200).json({ response: llmResponse });
  } catch (error) {
    next(error);
  }
};
