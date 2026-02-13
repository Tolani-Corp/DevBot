import { TwitterApi } from 'twitter-api-v2';

// Lazy load client to avoid crash if keys are missing
export function getTwitterClient() {
    const appKey = process.env.TWITTER_APP_KEY;
    const appSecret = process.env.TWITTER_APP_SECRET;
    const accessToken = process.env.TWITTER_ACCESS_TOKEN;
    const accessSecret = process.env.TWITTER_ACCESS_SECRET;

    if (!appKey || !appSecret || !accessToken || !accessSecret) {
        console.warn("⚠️ Twitter/X credentials missing in .env");
        return null;
    }

    return new TwitterApi({
        appKey,
        appSecret,
        accessToken,
        accessSecret,
    });
}

// Function to post a tweet
export async function postTweet(content: string) {
    const client = getTwitterClient();
    if (!client) return { success: false, error: "Missing credentials" };

    try {
        const rwClient = client.readWrite;
        const response = await rwClient.v2.tweet(content);
        return { success: true, response };
    } catch (error) {
        console.error("❌ Failed to post tweet:", error);
        return { success: false, error };
    }
}
