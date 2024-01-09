"use node";

import { action } from "./_generated/server";
import { v } from "convex/values";

export const decodeBodyMessageData = action({
  args: {
    data: v.any(),
  },
  handler: async (_, { data }) => Buffer.from(data, "base64url").toString(),
});
