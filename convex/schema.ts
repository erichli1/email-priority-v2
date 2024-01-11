import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export const IntervalType = v.union(
  v.literal("every hour"),
  v.literal("every 2 hours")
);

export default defineSchema(
  {
    watch: defineTable({
      email: v.string(),
      clerkUserId: v.string(),
      tokenIdentifier: v.string(),
      lastHistoryId: v.number(),
      phoneNumber: v.string(),
      interval: IntervalType,
    }),
    messageQueue: defineTable({
      clerkUserId: v.string(),
      phoneNumber: v.string(),
      subject: v.string(),
      priority: v.string(),
      interval: IntervalType,
    }),
  },
  // If you ever get an error about schema mismatch
  // between your data and your schema, and you cannot
  // change the schema to match the current data in your database,
  // you can:
  //  1. Use the dashboard to delete tables or individual documents
  //     that are causing the error.
  //  2. Change this option to `false` and make changes to the data
  //     freely, ignoring the schema. Don't forget to change back to `true`!
  { schemaValidation: true }
);
