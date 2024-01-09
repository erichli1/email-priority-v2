import { httpRouter } from "convex/server";
import { receiveMessage } from "./myHttpActions";

const http = httpRouter();

http.route({
  path: "/receive",
  method: "POST",
  handler: receiveMessage,
});

export default http;
