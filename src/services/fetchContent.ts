import axios from "axios";
import * as cheerio from "cheerio";
import { TwitterApi } from "twitter-api-v2";
import { YoutubeTranscript } from "youtube-transcript";

interface TwitterConfig {
  apiKey: string;
  apiKeySecret: string;
  accessToken: string;
  accessTokenSecret: string;
}

export async function fetchTweetContent(link: string): Promise<string> {
  try {
    const tweetId = extractTweetId(link);
    if (!tweetId) {
      throw new Error("Invalid Twitter URL");
    }

    const config: TwitterConfig = {
      apiKey: process.env.TWITTER_API_KEY!,
      apiKeySecret: process.env.TWITTER_API_SECRET!,
      accessToken: process.env.TWITTER_ACCESS_TOKEN!,
      accessTokenSecret: process.env.TWITTER_ACCESS_TOKEN_SECRET!,
    };

    const twitterClient = new TwitterApi({
      appKey: config.apiKey,
      appSecret: config.apiKeySecret,
      accessToken: config.accessToken,
      accessSecret: config.accessTokenSecret,
    });

    const tweet = await twitterClient.v2.singleTweet(tweetId, {
      expansions: ["author_id"],
      "tweet.fields": ["text", "created_at"],
    });

    return tweet.data.text;
  } catch (error: Error | any) {
    console.error("Error fetching tweet:", error);
    throw new Error(`Failed to fetch tweet content: ${error.message}`);
  }
}

export async function fetchYoutubeTranscript(link: string): Promise<string> {
  try {
    const videoId = extractYoutubeVideoId(link);
    if (!videoId) {
      throw new Error("Invalid YouTube URL");
    }

    const transcriptList = await YoutubeTranscript.fetchTranscript(videoId);

    const fullTranscript = transcriptList
      .map((item) => item.text)
      .join(" ")
      .trim();

    return fullTranscript;
  } catch (error: Error | any) {
    console.error("Error fetching YouTube transcript:", error);

    throw new Error(`Failed to fetch YouTube transcript: ${error.message}`);
  }
}

export async function fetchWebpageContent(link: string): Promise<string> {
  try {
    const response = await axios.get(link, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
      },
    });

    const $ = cheerio.load(response.data);

    $("script").remove();
    $("style").remove();
    $("nav").remove();
    $("header").remove();
    $("footer").remove();
    $("aside").remove();

    let content = $("article, main, .content, #content, #main").text();

    if (!content.trim()) {
      content = $("body").text();
    }

    return cleanText(content);
  } catch (error: Error | any) {
    console.error("Error fetching webpage:", error);
    throw new Error(`Failed to fetch webpage content: ${error.message}`);
  }
}

function extractTweetId(url: string): string | null {
  const match = url.match(/twitter\.com\/\w+\/status\/(\d+)/);
  return match ? match[1] : null;
}

function extractYoutubeVideoId(url: string): string | null {
  const match = url.match(
    /(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/))([^&\s]+)/
  );
  return match ? match[1] : null;
}

function cleanText(text: string): string {
  return text.replace(/\s+/g, " ").replace(/\n+/g, "\n").trim();
}
