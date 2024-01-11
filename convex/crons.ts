import { cronJobs } from "convex/server";
import { api } from "./_generated/api";

const crons = cronJobs();

crons.cron(
  "refresh watch every sunday and thursday",
  "0 0 * * 0,4",
  api.myFunctions.refreshWatch
);

crons.cron(
  "clear message queue every 2 hours",
  "0 */2 * * *",
  api.myFunctions.clearMessageQueue,
  { interval: "every 2 hours" }
);

crons.hourly(
  "clear message queue every hour",
  { minuteUTC: 0 },
  api.myFunctions.clearMessageQueue,
  { interval: "every hour" }
);

export default crons;
