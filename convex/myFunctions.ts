import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { api } from "./_generated/api";
import { IntervalType } from "./schema";

export const addToWatchIfNonexistent = mutation({
  args: {
    email: v.string(),
    clerkUserId: v.string(),
    tokenIdentifier: v.string(),
    lastHistoryId: v.number(),
    phoneNumber: v.string(),
  },
  handler: async (
    ctx,
    { email, clerkUserId, tokenIdentifier, lastHistoryId, phoneNumber }
  ) => {
    const existing = await ctx.db
      .query("watch")
      .filter((q) => q.eq(q.field("tokenIdentifier"), tokenIdentifier))
      .first();

    if (existing) console.log("Skipping watch bc user already exists");
    else {
      await ctx.db.insert("watch", {
        email,
        clerkUserId,
        tokenIdentifier,
        lastHistoryId,
        phoneNumber,
        interval: "every hour",
      });
      console.log(`Added ${email} to watch`);
    }
  },
});

export const deleteFromWatch = mutation({
  args: { tokenIdentifier: v.string() },
  handler: async (ctx, { tokenIdentifier }) => {
    const existing = await ctx.db
      .query("watch")
      .filter((q) => q.eq(q.field("tokenIdentifier"), tokenIdentifier))
      .first();

    if (!existing) console.log("Skipping delete bc user doesn't exist");
    else {
      await ctx.db.delete(existing._id);
      console.log(`Deleted watch for ${existing.email}`);
    }
  },
});

export const processHistoryUpdate = mutation({
  args: { emailAddress: v.string(), historyId: v.number() },
  handler: async (ctx, { emailAddress, historyId }) => {
    const existing = await ctx.db
      .query("watch")
      .filter((q) => q.eq(q.field("email"), emailAddress))
      .first();

    if (!existing) console.log("Skipping history update bc user doesn't exist");
    else {
      await ctx.scheduler.runAfter(10, api.nodeActions.getNewMessages, {
        clerkUserId: existing.clerkUserId,
        lastHistoryId: existing.lastHistoryId,
        phoneNumber: existing.phoneNumber,
        interval: existing.interval ?? "every hour",
      });
      await ctx.db.patch(existing._id, { lastHistoryId: historyId });
    }
  },
});

export const getWatch = query({
  handler: async (ctx) => {
    const user = await ctx.auth.getUserIdentity();
    if (user) {
      const existing = await ctx.db
        .query("watch")
        .filter((q) => q.eq(q.field("tokenIdentifier"), user.tokenIdentifier))
        .first();

      if (!existing) return null;
      else return existing;
    }
  },
});

export const refreshWatch = mutation({
  handler: async (ctx) => {
    const watchesToRefresh = await ctx.db.query("watch").collect();

    await Promise.all(
      watchesToRefresh.map((watch) =>
        ctx.scheduler.runAfter(10, api.nodeActions.continueWatching, {
          email: watch.email,
          clerkUserId: watch.clerkUserId,
        })
      )
    );
  },
});

export const addToMessageQueue = mutation({
  args: {
    clerkUserId: v.string(),
    phoneNumber: v.string(),
    subject: v.string(),
    priority: v.string(),
    interval: IntervalType,
  },
  handler: async (
    ctx,
    { clerkUserId, phoneNumber, subject, priority, interval }
  ) => {
    await ctx.db.insert("messageQueue", {
      clerkUserId,
      phoneNumber,
      subject,
      priority,
      interval,
    });
  },
});

export const clearMessageQueue = mutation({
  args: { interval: IntervalType },
  handler: async (ctx, { interval }) => {
    const messages = await ctx.db
      .query("messageQueue")
      .filter((q) => q.eq(q.field("interval"), interval))
      .collect();

    const grouped: {
      [id: string]: { phoneNumber: string; subjects: string[] };
    } = messages.reduce(
      (
        result: { [id: string]: { phoneNumber: string; subjects: string[] } },
        obj
      ) => {
        if (!result[obj.clerkUserId])
          result[obj.clerkUserId] = {
            phoneNumber: obj.phoneNumber,
            subjects: [obj.subject],
          };
        else result[obj.clerkUserId].subjects.push(obj.subject);

        return result;
      },
      {}
    );

    await Promise.all(
      Object.entries(grouped).map(([, { phoneNumber, subjects }]) =>
        ctx.scheduler.runAfter(10, api.nodeActions.sendTwilioMessage, {
          phoneNumber,
          subject: `${subjects.length} OTHER EMAILS: ${subjects.join("; ")}`,
        })
      )
    );

    await Promise.all(messages.map((message) => ctx.db.delete(message._id)));
  },
});
