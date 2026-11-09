// Supabase client for Storage (uploading photos). The database itself still goes through config/db.js.
// Uses the SECRET key, so this must only ever run on the backend, never in the frontend.
require("dotenv").config();
const { createClient } = require("@supabase/supabase-js");

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SECRET_KEY;

// If the keys are missing (e.g. a new Vercel project or a teammate's .env), DON'T crash the whole server:
// export null, and only photo upload says it isn't set up. Everything else keeps working.
if (!url || !key) {
  console.warn("SUPABASE_URL / SUPABASE_SECRET_KEY not set: photo upload is turned off");
}

const supabase = url && key ? createClient(url, key, { auth: { persistSession: false } }) : null;

module.exports = supabase;
