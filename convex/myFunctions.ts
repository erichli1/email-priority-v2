import { v } from "convex/values";
import { query, mutation, action } from "./_generated/server";
import { api } from "./_generated/api";

// Write your Convex functions in any file inside this directory (`convex`).
// See https://docs.convex.dev/functions for more.

// You can read data from the database via a query:
export const listNumbers = query({
  // Validators for arguments.
  args: {
    count: v.number(),
  },

  // Query implementation.
  handler: async (ctx, args) => {
    //// Read the database as many times as you need here.
    //// See https://docs.convex.dev/database/reading-data.
    const numbers = await ctx.db
      .query("numbers")
      // Ordered by _creationTime, return most recent
      .order("desc")
      .take(args.count);
    return {
      viewer: (await ctx.auth.getUserIdentity())?.name ?? null,
      numbers: numbers.toReversed().map((number) => number.value),
    };
  },
});

// You can write data to the database via a mutation:
export const addNumber = mutation({
  // Validators for arguments.
  args: {
    value: v.number(),
  },

  // Mutation implementation.
  handler: async (ctx, args) => {
    //// Insert or modify documents in the database here.
    //// Mutations can also read from the database like queries.
    //// See https://docs.convex.dev/database/writing-data.

    const id = await ctx.db.insert("numbers", { value: args.value });

    console.log("Added new document with id:", id);
    // Optionally, return a value from your mutation.
    // return id;
  },
});

// You can fetch data from and send data to third-party APIs via an action:
export const myAction = action({
  // Validators for arguments.
  args: {
    first: v.number(),
    second: v.string(),
  },

  // Action implementation.
  handler: async (ctx, args) => {
    //// Use the browser-like `fetch` API to send HTTP requests.
    //// See https://docs.convex.dev/functions/actions#calling-third-party-apis-and-using-npm-packages.
    // const response = await ctx.fetch("https://api.thirdpartyservice.com");
    // const data = await response.json();

    //// Query data by running Convex queries.
    const data = await ctx.runQuery(api.myFunctions.listNumbers, {
      count: 10,
    });
    console.log(data);

    //// Write data by running Convex mutations.
    await ctx.runMutation(api.myFunctions.addNumber, {
      value: args.first,
    });
  },
});

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
