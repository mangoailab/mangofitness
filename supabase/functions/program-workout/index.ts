import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

type WorkoutExercise = {
  section: "lifting" | "cardio" | "partner";
  name: string;
  sets: string;
  reps: string;
  weight: string;
  target: string;
  notes: string;
};

type WorkoutDraft = {
  date: string;
  title: string;
  notes: string;
  warmupNotes: string;
  cardioNotes: string;
  exercises: WorkoutExercise[];
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" }
  });
}

function getBearerToken(req: Request): string {
  return (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "").trim();
}

function cleanText(value: unknown, max = 4000): string {
  return String(value || "").replace(/\r\n/g, "\n").trim().slice(0, max);
}

function cleanDate(value: unknown): string {
  const text = cleanText(value, 32);
  return /^20\d{2}-\d{2}-\d{2}$/.test(text) ? text : "";
}

function cleanSection(value: unknown): WorkoutExercise["section"] {
  const section = cleanText(value, 32).toLowerCase();
  return section === "lifting" || section === "partner" || section === "cardio" ? section : "cardio";
}

function validateDraft(raw: any, fallbackDate = ""): WorkoutDraft {
  const exercises = Array.isArray(raw?.exercises) ? raw.exercises : [];
  return {
    date: cleanDate(raw?.date) || fallbackDate,
    title: cleanText(raw?.title, 120) || "AI workout draft",
    notes: cleanText(raw?.notes),
    warmupNotes: cleanText(raw?.warmupNotes),
    cardioNotes: cleanText(raw?.cardioNotes),
    exercises: exercises.slice(0, 12).map((exercise: any) => ({
      section: cleanSection(exercise?.section),
      name: cleanText(exercise?.name, 120),
      sets: cleanText(exercise?.sets, 80),
      reps: cleanText(exercise?.reps, 120),
      weight: cleanText(exercise?.weight, 80),
      target: cleanText(exercise?.target, 160),
      notes: cleanText(exercise?.notes, 600)
    })).filter((exercise: WorkoutExercise) => exercise.name)
  };
}

async function verifyCoach(req: Request): Promise<Response | { token: string } > {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !anonKey || !serviceRoleKey) return jsonResponse({ error: "AI programming is not configured." }, 503);

  const token = getBearerToken(req);
  if (!token) return jsonResponse({ error: "Coach sign-in required." }, 401);

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false }
  });
  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });

  const { data: callerData, error: callerError } = await userClient.auth.getUser(token);
  const caller = callerData?.user;
  if (callerError || !caller) return jsonResponse({ error: "Invalid coach session. Sign out and sign back in." }, 401);

  const { data: coachRows, error: coachError } = await adminClient
    .from("coach_profiles")
    .select("id")
    .eq("auth_user_id", caller.id)
    .limit(1);
  if (coachError) return jsonResponse({ error: "Could not verify coach access." }, 500);
  if (!coachRows?.length) return jsonResponse({ error: "Coach access required." }, 403);
  return { token };
}

const workoutSchema = {
  type: "object",
  additionalProperties: false,
  required: ["date", "title", "notes", "warmupNotes", "cardioNotes", "exercises"],
  properties: {
    date: { type: "string", description: "Workout date in YYYY-MM-DD format, or blank if not specified." },
    title: { type: "string" },
    notes: { type: "string", description: "Overall coach notes, intent, pacing, and scaling." },
    warmupNotes: { type: "string", description: "Warm-up instructions." },
    cardioNotes: { type: "string", description: "WOD/cardio instructions that apply to the scored section." },
    exercises: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["section", "name", "sets", "reps", "weight", "target", "notes"],
        properties: {
          section: { type: "string", enum: ["lifting", "cardio", "partner"] },
          name: { type: "string" },
          sets: { type: "string" },
          reps: { type: "string" },
          weight: { type: "string" },
          target: { type: "string" },
          notes: { type: "string" }
        }
      }
    }
  }
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  const coach = await verifyCoach(req);
  if (coach instanceof Response) return coach;

  const apiKey = Deno.env.get("OPENAI_API_KEY");
  if (!apiKey) return jsonResponse({ error: "OpenAI is not configured yet." }, 503);

  try {
    const body = await req.json();
    const action = cleanText(body?.action, 32) === "improve" ? "improve" : "draft";
    const prompt = cleanText(body?.prompt, 3000);
    const currentWorkout = body?.currentWorkout || {};
    const fallbackDate = cleanDate(currentWorkout?.date);
    const movements = Array.isArray(body?.movements) ? body.movements.slice(0, 120).map((item: unknown) => cleanText(item, 80)).filter(Boolean) : [];
    const cardioBenchmarks = Array.isArray(body?.cardioBenchmarks) ? body.cardioBenchmarks.slice(0, 80) : [];
    if (!prompt) return jsonResponse({ error: "Describe what you want to program." }, 400);

    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: Deno.env.get("OPENAI_PROGRAM_MODEL") || "gpt-4o-mini",
        input: [
          {
            role: "system",
            content: [{
              type: "input_text",
              text: "You are an experienced CrossFit-style strength and conditioning coach. Create practical workout drafts for a coach to review before saving. Return JSON only in the requested schema. Keep programming safe, clear, and editable. Use lifting rows for strength work, cardio rows for scored WOD/cardio options, and partner rows only for partner workouts. Do not invent athlete-specific medical advice."
            }]
          },
          {
            role: "user",
            content: [{
              type: "input_text",
              text: JSON.stringify({
                task: action === "improve" ? "Improve the current workout draft according to the coach request." : "Create a workout draft from the coach request.",
                coachRequest: prompt,
                currentWorkout,
                availableStrengthMovements: movements,
                availableCardioBenchmarks: cardioBenchmarks,
                outputRules: [
                  "Use concise titles.",
                  "Put warm-up details in warmupNotes.",
                  "Put workout-wide WOD instructions in cardioNotes.",
                  "Each scored station or movement should become one exercise row.",
                  "For partner workouts, include partner rows and a clear partner scoring target.",
                  "Leave unknown fields as blank strings rather than guessing."
                ]
              })
            }]
          }
        ],
        text: {
          format: {
            type: "json_schema",
            name: "workout_draft",
            strict: true,
            schema: workoutSchema
          }
        }
      })
    });

    if (!response.ok) {
      const details = await response.text();
      return jsonResponse({ error: "AI programming failed.", details }, 502);
    }

    const data = await response.json();
    const raw = data.output_text || data.output?.flatMap((item: any) => item.content || []).find((item: any) => item.type === "output_text")?.text || "{}";
    return jsonResponse({ draft: validateDraft(JSON.parse(raw), fallbackDate) });
  } catch (error) {
    return jsonResponse({ error: error instanceof Error ? error.message : "Unable to generate workout." }, 500);
  }
});
