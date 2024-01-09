import { api } from "./_generated/api";
import { httpAction } from "./_generated/server";

export const receiveMessage = httpAction(async (ctx, request) => {
  const body = await request.json();
  if (body) {
    const data = await ctx.runAction(api.nodeActions.decodeBodyMessageData, {
      data: body.message.data,
    });
    console.log(`Received message: ${data}`);
  }

  return new Response(null, {
    status: 200,
  });
});
