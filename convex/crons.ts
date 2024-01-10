import { cronJobs } from "convex/server";
import { api } from "./_generated/api";

const crons = cronJobs();

crons.cron(
  "refresh watch every sunday and thursday",
  "0 0 * * 0,4",
  api.myFunctions.refreshWatch
);

export default crons;
