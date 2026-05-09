import { cronJobs } from "convex/server";
import { internal, api } from "./_generated/api";

const crons = cronJobs();

crons.interval(
  "sync supabase global stats every 5 min",
  { minutes: 5 },
  api.sync.syncFromSupabase,
);

export default crons;
