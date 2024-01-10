"use node";

import { action } from "./_generated/server";
import { v } from "convex/values";
import clerkClient from "@clerk/clerk-sdk-node";
import { gmail } from "@googleapis/gmail";
import { OAuth2Client } from "google-auth-library";
import { api } from "./_generated/api";
import OpenAI from "openai";
import { Twilio } from "twilio";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const twilio = new Twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

export const base64decoder = action({
  args: {
    data: v.any(),
  },
  handler: async (_, { data }) => Buffer.from(data, "base64url").toString(),
});

export const startWatching = action({
  args: {
    phoneNumber: v.string(),
  },
  handler: async (ctx, { phoneNumber }) => {
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
          phoneNumber,
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
    phoneNumber: v.string(),
  },
  handler: async (ctx, { clerkUserId, lastHistoryId, phoneNumber }) => {
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

        const date = message.data.payload?.headers?.find(
          (header) => header.name === "Date"
        )?.value;

        const encodedBody = message.data.payload?.parts?.find(
          (part) => part.mimeType === "text/plain"
        )?.body?.data;
        if (!subject || !date || !encodedBody) {
          console.log(
            `Skipping message ${messageId} due to missing subject, date, or body`
          );
          return;
        }

        const body = await ctx.runAction(api.nodeActions.base64decoder, {
          data: encodedBody,
        });

        const priority = await ctx.runAction(api.nodeActions.getPriority, {
          subject,
          date,
          body,
        });

        if (priority === "high") {
          await ctx.scheduler.runAfter(10, api.nodeActions.sendTwilioMessage, {
            subject,
            phoneNumber: "+1" + phoneNumber,
          });
        }
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

export const getPriority = action({
  args: {
    subject: v.string(),
    date: v.string(),
    body: v.string(),
  },
  handler: async (_, { subject, date, body }) => {
    const response = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: `You are an email priority classifier. The user will input an email subject, date, and body, and you will output a priority of either high, medium, or low. Your response should only be one word, either "high", "medium", or "low". You can determine the priority of an email depending on how time-sensitive the email is and how important the message is to the user. If you are unclear (ex: it could be high priority depending on the context), please output "unclear". Examples of high priority emails include requests for interviews, questions about scheduling, and required actions with short deadlines. Examples of low priority emails include newsletters, emails that publicize events, or student club advertisements. Note that the current datetime is ${new Date().toISOString()}.`,
        },
        {
          role: "system",
          content:
            "Given SUBJECT: Join T4SG and BODY: Apply now to join Tech for Social Good, you should output 'low'. Given SUBJECT: Harvard Startup Trek and BODY: When should we schedule the startup visit for on 2/8?, you should output 'high'.",
        },
        {
          role: "user",
          content: `SUBJECT: ${subject}\nDATE: ${date}\nBODY: ${body}`,
        },
      ],
    });
    const responseText = response.choices[0].message?.content;

    if (responseText?.includes("high")) return "high";
    else if (responseText?.includes("medium")) return "medium";
    else if (responseText?.includes("low")) return "low";
    else if (responseText?.includes("unclear")) return "unclear";
    else return "error";
  },
});

export const sendTwilioMessage = action({
  args: {
    subject: v.string(),
    phoneNumber: v.string(),
  },
  handler: async (_, { subject, phoneNumber }) => {
    const sentMessage = await twilio.messages.create({
      body: subject,
      from: "+18336583496",
      to: phoneNumber,
    });
    console.log(`Sent Twilio message ${sentMessage.sid} to ${phoneNumber}`);
  },
});
