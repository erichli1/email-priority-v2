"use node";

import { action } from "./_generated/server";
import { v } from "convex/values";
import clerkClient from "@clerk/clerk-sdk-node";
import { gmail } from "@googleapis/gmail";
import { OAuth2Client } from "google-auth-library";
import { api } from "./_generated/api";

export const base64decoder = action({
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
          labelIds: ["UNREAD"],
          labelFilterBehavior: "INCLUDE",
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

export const getNewMessages = action({
  args: {
    clerkUserId: v.string(),
    lastHistoryId: v.number(),
  },
  handler: async (ctx, { clerkUserId, lastHistoryId }) => {
    const client = await getGmailClient({ clerkUserId });
    const response = await client.users.history.list({
      userId: "me",
      startHistoryId: lastHistoryId.toString(),
    });

    const messageIds: string[] = [];
    response.data.history?.forEach((history) => {
      history.messagesAdded?.forEach((message) => {
        if (message.message?.id) messageIds.push(message.message.id);
      });
    });
    if (messageIds.length > 0)
      console.log(`New messages ${messageIds.toString()}`);

    await Promise.all(
      messageIds.map(async (messageId) => {
        const message = await client.users.messages.get({
          userId: "me",
          id: messageId,
        });

        const subject = message.data.payload?.headers?.find(
          (header) => header.name === "Subject"
        )?.value;

        const encodedBody = message.data.payload?.parts?.find(
          (part) => part.mimeType === "text/plain"
        )?.body?.data;
        if (!encodedBody) return;
        const body = await ctx.runAction(api.nodeActions.base64decoder, {
          data: encodedBody,
        });

        console.log(`Processing message ${messageId}`);
        console.log(`Subject: ${subject}`);
        console.log(`Body: ${body}`);
        console.log("-----------------------");
      })
    );
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
