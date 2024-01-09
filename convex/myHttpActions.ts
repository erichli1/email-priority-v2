import { httpAction } from "./_generated/server";

export const receiveMessage = httpAction(async (ctx, request) => {
  const body = await request.json();
  if (body) {
    const data = Buffer.from(body.message.data, "base64url").toString();
    console.log(`Received message: ${data}`);
  }
  return new Response(null, {
    status: 200,
    headers: new Headers({
      "Access-Control-Allow-Origin": "*",
      Vary: "Origin",
    }),
  });
});
