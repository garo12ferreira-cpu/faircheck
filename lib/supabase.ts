// Server-side Supabase client. Uses the service-role key, so it must only be
// imported from route handlers, never from client components. Every query
// must filter by the Clerk user id taken from auth(), never from the request.

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | null | undefined;

export function supabaseAdmin(): SupabaseClient | null {
  if (client !== undefined) return client;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  client = url && key ? createClient(url, key, { auth: { persistSession: false } }) : null;
  return client;
}

export const AUDITS_TABLE = "audits";
