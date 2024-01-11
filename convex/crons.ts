import { cronJobs } from "convex/server";
import { api } from "./_generated/api";

const crons = cronJobs();

crons.cron(
  "refresh watch every sunday and thursday",
  "0 0 * * 0,4",
  api.myFunctions.refreshWatch
);

crons.hourly(
  "clear message queue",
  { minuteUTC: 0 },
  api.myFunctions.clearMessageQueue
);

export default crons;
