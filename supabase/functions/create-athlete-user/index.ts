import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" }
  });
}

function appError(message: string, details?: Record<string, unknown>) {
  return json({ error: message, ...(details || {}) }, 200);
}

function randomPassword() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%";
  const bytes = crypto.getRandomValues(new Uint8Array(18));
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return appError("Method not allowed");

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return appError("Missing Supabase Edge Function environment variables.");
  }

  const authHeader = req.headers.get("Authorization") || "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!token) return appError("Missing coach session. Sign out and sign back in as coach.");

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false }
  });
  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });

  const { data: callerData, error: callerError } = await userClient.auth.getUser(token);
  const caller = callerData?.user;
  if (callerError || !caller) return appError("Invalid coach session. Sign out and sign back in as coach.");

  const { data: coachRows, error: coachError } = await adminClient
    .from("coach_profiles")
    .select("id")
    .eq("auth_user_id", caller.id)
    .limit(1);
  if (coachError) return appError("Could not verify coach access.");
  if (!coachRows?.length) return appError("Coach access required.");

  let body: { action?: string; athleteId?: string; email?: string; redirectTo?: string } = {};
  try {
    body = await req.json();
  } catch (_err) {
    return appError("Invalid JSON body.");
  }

  const action = String(body.action || "create-user").trim();
  const athleteId = String(body.athleteId || "").trim();
  const email = String(body.email || "").trim().toLowerCase();
  const redirectTo = String(body.redirectTo || "").trim() || undefined;
  if (!athleteId) return appError("Missing athlete ID.");

  const { data: athlete, error: athleteError } = await adminClient
    .from("athletes")
    .select("id, name, email, auth_user_id")
    .eq("id", athleteId)
    .single();
  if (athleteError || !athlete) return appError("Athlete not found.");

  async function linkedUserIsCoach(userId: string) {
    const { data, error } = await adminClient
      .from("coach_profiles")
      .select("id")
      .eq("auth_user_id", userId)
      .limit(1);
    if (error) return true;
    return Boolean(data?.length);
  }

  async function findAuthUserByEmail(targetEmail: string) {
    const normalized = targetEmail.trim().toLowerCase();
    for (let page = 1; page <= 20; page += 1) {
      const { data, error } = await adminClient.auth.admin.listUsers({ page, perPage: 100 });
      if (error) throw error;
      const found = data.users.find((u) => String(u.email || "").toLowerCase() === normalized);
      if (found) return found;
      if (data.users.length < 100) break;
    }
    return null;
  }

  if (action === "link-existing-user") {
    if (!email || !email.includes("@")) return appError("Athlete email is required.");
    const existingUser = await findAuthUserByEmail(email);
    if (!existingUser) {
      return appError("No Supabase Auth user found for this athlete email. Use Create Login instead.");
    }
    if (await linkedUserIsCoach(existingUser.id)) {
      return appError("Refusing to link: that email belongs to a coach user.");
    }
    const { error: linkError } = await adminClient
      .from("athletes")
      .update({ email, auth_user_id: existingUser.id })
      .eq("id", athleteId);
    if (linkError) {
      return appError("Found the Auth user, but athlete linking failed.", { userId: existingUser.id });
    }
    return json({
      userId: existingUser.id,
      email: existingUser.email,
      message: "Existing athlete login linked."
    });
  }

  if (action === "set-temporary-password") {
    if (!athlete.auth_user_id) return appError("Athlete does not have a linked login.");
    if (await linkedUserIsCoach(athlete.auth_user_id)) {
      return appError("Refusing to change password: this athlete is linked to a coach user ID. Fix the Auth user ID first.");
    }
    const tempPassword = randomPassword();
    const { data: updated, error: updateUserError } = await adminClient.auth.admin.updateUserById(
      athlete.auth_user_id,
      { password: tempPassword }
    );
    if (updateUserError || !updated?.user) {
      return appError(updateUserError?.message || "Could not set temporary password.");
    }
    return json({
      userId: updated.user.id,
      email: updated.user.email,
      tempPassword,
      message: "Temporary password set."
    });
  }

  if (action !== "create-user") return appError("Unknown action.");
  if (!email || !email.includes("@")) return appError("Athlete email is required.");
  if (athlete.auth_user_id && await linkedUserIsCoach(athlete.auth_user_id)) {
    return appError("Refusing to use this athlete link: Auth user ID belongs to a coach user.");
  }
  if (athlete.auth_user_id) {
    return json({
      userId: athlete.auth_user_id,
      alreadyLinked: true,
      message: "Athlete already has a linked login."
    });
  }

  const tempPassword = randomPassword();
  const { data: created, error: createError } = await adminClient.auth.admin.createUser({
    email,
    password: tempPassword,
    email_confirm: true,
    user_metadata: {
      role: "athlete",
      athlete_id: athleteId,
      name: athlete.name || ""
    }
  });

  if (createError || !created?.user) {
    const message = createError?.message || "Could not create athlete login.";
    const status = /already|registered|exists/i.test(message) ? 409 : 400;
    return appError(message, {
      hint: status === 409 ? "That email may already exist in Supabase Auth. Use Find & Link Existing User instead." : undefined
    });
  }

  const { error: updateError } = await adminClient
    .from("athletes")
    .update({ email, auth_user_id: created.user.id })
    .eq("id", athleteId);

  if (updateError) {
    return appError("Login was created, but athlete linking failed. Copy this user ID into the athlete manually.", {
      userId: created.user.id,
      tempPassword
    });
  }

  let resetLink = "";
  if (redirectTo) {
    const { data: linkData } = await adminClient.auth.admin.generateLink({
      type: "recovery",
      email,
      options: { redirectTo }
    });
    resetLink = linkData?.properties?.action_link || "";
  }

  return json({
    userId: created.user.id,
    email,
    tempPassword,
    resetLink,
    message: "Athlete login created and linked."
  });
});
