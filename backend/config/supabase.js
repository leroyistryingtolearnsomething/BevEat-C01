// Supabase client for Storage (uploading photos). The database itself still goes through config/db.js.
// Uses the SECRET key, so this must only ever run on the backend, never in the frontend.
require("dotenv").config();
const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, {
  auth: { persistSession: false }, // server side: no login session to keep
});

module.exports = supabase;
