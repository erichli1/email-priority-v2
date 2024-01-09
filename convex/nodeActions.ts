"use node";

import { action } from "./_generated/server";
import { v } from "convex/values";
import clerkClient from "@clerk/clerk-sdk-node";
import { gmail } from "@googleapis/gmail";
import { OAuth2Client } from "google-auth-library";
import { api } from "./_generated/api";

export const decodeBodyMessageData = action({
  args: {
    data: v.any(),
  },
  handler: async (_, { data }) => Buffer.from(data, "base64url").toString(),
});

export const startWatching = action({
  handler: async (ctx) => {
    const user = await ctx.auth.getUserIdentity();
    if (user) {
      const client = await getGmailClient({ clerkUserId: user.subject });

      const response = await client.users.watch({
        userId: "me",
        requestBody: {
          topicName: "projects/email-priority-classifier/topics/gmail",
          labelIds: ["INBOX"],
        },
      });
      console.log(
        `Triggered watch for ${user.email} with status ${response.status}`
      );

      if (response.data.historyId)
        await ctx.runMutation(api.myFunctions.addToWatchIfNonexistent, {
          email: user.email!,
          clerkUserId: user.subject,
          tokenIdentifier: user.tokenIdentifier,
          lastHistoryId: parseInt(response.data.historyId),
        });
    }
  },
});

export const stopWatching = action({
  handler: async (ctx) => {
    const user = await ctx.auth.getUserIdentity();
    if (user) {
      const client = await getGmailClient({ clerkUserId: user.subject });
      const response = await client.users.stop({
        userId: "me",
      });
      console.log(
        `Triggered stop for ${user.email} with status ${response.status}`
      );

      await ctx.runMutation(api.myFunctions.deleteFromWatch, {
        tokenIdentifier: user.tokenIdentifier,
      });
    }
  },
});

const getGmailClient = async ({ clerkUserId }: { clerkUserId: string }) => {
  const [accessToken] = await clerkClient.users.getUserOauthAccessToken(
    clerkUserId,
    "oauth_google"
  );

  const oauth2 = new OAuth2Client({
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  });

  oauth2.setCredentials({
    access_token: accessToken.token,
  });

  const client = gmail({
    version: "v1",
    auth: oauth2,
  });

  return client;
};
