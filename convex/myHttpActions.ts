import { api } from "./_generated/api";
import { httpAction } from "./_generated/server";

export const receiveMessage = httpAction(async (ctx, request) => {
  const body = await request.json();
  if (body) {
    const data = await ctx.runAction(api.nodeActions.base64decoder, {
      data: body.message.data,
    });
    console.log(`Received push notif: ${data}`);

    const jsonData = JSON.parse(data);
    if ("emailAddress" in jsonData && "historyId" in jsonData)
      await ctx.runMutation(api.myFunctions.processHistoryUpdate, {
        emailAddress: jsonData.emailAddress.toString(),
        historyId: parseInt(jsonData.historyId),
      });
  }

  return new Response(null, {
    status: 200,
  });
});
