const MangoFitnessStore = (() => {
  const localWorkoutKey = "mangoFitness.workouts.v1";
  const localResultKey = "mangoFitness.results.v1";
  const localWarmupTemplateKey = "mangoFitness.warmupTemplates.v1";
  const localStrengthMovementKey = "mangoFitness.strengthMovements.v1";
  const localCardioBenchmarkKey = "mangoFitness.cardioBenchmarks.v1";

  function client() {
    return window.mangoSupabaseClient || (typeof supabaseClient !== "undefined" ? supabaseClient : null);
  }

  function readLocal(key) {
    try { return JSON.parse(localStorage.getItem(key) || "[]"); }
    catch { return []; }
  }

  function writeLocal(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  function normalizeWorkout(row) {
    return {
      id: row.id,
      date: row.workout_date,
      title: row.title,
      notes: row.notes || "",
      warmupNotes: row.warmup_notes || row.warmupNotes || "",
      cardioNotes: row.cardio_notes || row.cardioNotes || "",
      format: row.workout_format || row.format || "Strength",
      rounds: row.rounds || "",
      scoreType: row.score_type || "",
      exercises: (row.workout_exercises || []).sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0)).map((exercise) => ({
        id: exercise.id,
        name: exercise.exercise_name,
        sets: exercise.sets || "",
        reps: exercise.reps || "",
        target: exercise.target || "",
        weight: exercise.target_weight || exercise.weight || "",
        benchmarkKey: exercise.benchmark_key || exercise.benchmarkKey || "",
        benchmarkName: exercise.benchmark_name || exercise.benchmarkName || "",
        movementKey: exercise.movement_key || exercise.movementKey || "",
        movementName: exercise.movement_name || exercise.movementName || "",
        section: exercise.section_type || exercise.section || "cardio",
        notes: exercise.notes || ""
      }))
    };
  }

  function normalizeResult(row) {
    const exercise = row.workout_exercises || {};
    return {
      id: row.id,
      workoutId: exercise.workout_id || "",
      exerciseId: row.workout_exercise_id,
      exerciseName: exercise.benchmark_name || exercise.movement_name || exercise.exercise_name || "Exercise",
      benchmarkKey: exercise.benchmark_key || "",
      benchmarkName: exercise.benchmark_name || "",
      movementKey: exercise.movement_key || "",
      movementName: exercise.movement_name || "",
      completedOn: row.completed_on,
      weight: row.working_weight ?? "",
      reps: row.reps_completed || "",
      notes: row.notes || "",
      score: row.score_result || "",
      isPr: Boolean(row.is_pr)
    };
  }

  function isUuid(value) {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value || "");
  }

  async function requireUser() {
    const sb = client();
    if (!sb) return null;
    const { data } = await sb.auth.getUser();
    return data.user || null;
  }

  return {
    async cardioBenchmarks() {
      const sb = client();
      if (!sb) return readLocal(localCardioBenchmarkKey);

      const { data, error } = await sb
        .from("cardio_benchmarks")
        .select("id, benchmark_key, name, score_type, description")
        .order("name", { ascending: true });
      if (error) throw error;
      return data || [];
    },

    async saveCardioBenchmark(benchmark) {
      const sb = client();
      if (!sb) {
        const benchmarks = readLocal(localCardioBenchmarkKey);
        const saved = { ...benchmark, id: uid("cardio-benchmark") };
        benchmarks.push(saved);
        writeLocal(localCardioBenchmarkKey, benchmarks.sort((a, b) => a.name.localeCompare(b.name)));
        return saved;
      }
      const user = await requireUser();
      const { data, error } = await sb
        .from("cardio_benchmarks")
        .insert({ name: benchmark.name, score_type: benchmark.scoreType, description: benchmark.description, created_by: user?.id || null })
        .select("id, benchmark_key, name, score_type, description")
        .single();
      if (error) throw error;
      return data;
    },

    async updateCardioBenchmark(id, benchmark) {
      const sb = client();
      if (!sb) {
        const benchmarks = readLocal(localCardioBenchmarkKey).map((item) => item.id === id ? { ...item, ...benchmark } : item);
        writeLocal(localCardioBenchmarkKey, benchmarks.sort((a, b) => a.name.localeCompare(b.name)));
        return { id, ...benchmark };
      }
      const { data, error } = await sb
        .from("cardio_benchmarks")
        .update({ name: benchmark.name, score_type: benchmark.scoreType, description: benchmark.description })
        .eq("id", id)
        .select("id, benchmark_key, name, score_type, description")
        .single();
      if (error) throw error;
      return data;
    },

    async deleteCardioBenchmark(id) {
      const sb = client();
      if (!sb) {
        writeLocal(localCardioBenchmarkKey, readLocal(localCardioBenchmarkKey).filter((item) => item.id !== id));
        return;
      }
      const { error } = await sb.from("cardio_benchmarks").delete().eq("id", id);
      if (error) throw error;
    },

    async strengthMovements() {
      const sb = client();
      if (!sb) return readLocal(localStrengthMovementKey);

      const { data, error } = await sb
        .from("strength_movements")
        .select("id, movement_key, name")
        .order("name", { ascending: true });
      if (error) throw error;
      return data || [];
    },

    async saveStrengthMovement(movement) {
      const sb = client();
      if (!sb) {
        const movements = readLocal(localStrengthMovementKey);
        const saved = { ...movement, id: uid("strength-movement") };
        movements.push(saved);
        writeLocal(localStrengthMovementKey, movements.sort((a, b) => a.name.localeCompare(b.name)));
        return saved;
      }
      const user = await requireUser();
      const { data, error } = await sb
        .from("strength_movements")
        .insert({ name: movement.name, created_by: user?.id || null })
        .select("id, movement_key, name")
        .single();
      if (error) throw error;
      return data;
    },

    async updateStrengthMovement(id, movement) {
      const sb = client();
      if (!sb) {
        const movements = readLocal(localStrengthMovementKey).map((item) => item.id === id ? { ...item, ...movement } : item);
        writeLocal(localStrengthMovementKey, movements.sort((a, b) => a.name.localeCompare(b.name)));
        return { id, ...movement };
      }
      const { data, error } = await sb
        .from("strength_movements")
        .update({ name: movement.name })
        .eq("id", id)
        .select("id, movement_key, name")
        .single();
      if (error) throw error;
      return data;
    },

    async deleteStrengthMovement(id) {
      const sb = client();
      if (!sb) {
        writeLocal(localStrengthMovementKey, readLocal(localStrengthMovementKey).filter((item) => item.id !== id));
        return;
      }
      const { error } = await sb.from("strength_movements").delete().eq("id", id);
      if (error) throw error;
    },

    async warmupTemplates() {
      const sb = client();
      if (!sb) return readLocal(localWarmupTemplateKey);

      const { data, error } = await sb
        .from("warmup_templates")
        .select("id, name, notes")
        .order("name", { ascending: true });
      if (error) throw error;
      return data || [];
    },

    async saveWarmupTemplate(template) {
      const sb = client();
      if (!sb) {
        const templates = readLocal(localWarmupTemplateKey);
        const saved = { ...template, id: uid("warmup-template") };
        templates.push(saved);
        writeLocal(localWarmupTemplateKey, templates.sort((a, b) => a.name.localeCompare(b.name)));
        return saved;
      }

      const user = await requireUser();
      const { data, error } = await sb
        .from("warmup_templates")
        .insert({ name: template.name, notes: template.notes, created_by: user?.id || null })
        .select("id, name, notes")
        .single();
      if (error) throw error;
      return data;
    },

    async updateWarmupTemplate(id, template) {
      const sb = client();
      if (!sb) {
        const templates = readLocal(localWarmupTemplateKey).map((item) => item.id === id ? { ...item, ...template } : item);
        writeLocal(localWarmupTemplateKey, templates.sort((a, b) => a.name.localeCompare(b.name)));
        return { id, ...template };
      }

      const { data, error } = await sb
        .from("warmup_templates")
        .update({ name: template.name, notes: template.notes })
        .eq("id", id)
        .select("id, name, notes")
        .single();
      if (error) throw error;
      return data;
    },

    async deleteWarmupTemplate(id) {
      const sb = client();
      if (!sb) {
        writeLocal(localWarmupTemplateKey, readLocal(localWarmupTemplateKey).filter((item) => item.id !== id));
        return;
      }

      const { error } = await sb.from("warmup_templates").delete().eq("id", id);
      if (error) throw error;
    },

    async workouts() {
      const sb = client();
      if (!sb) return readLocal(localWorkoutKey);

      const { data, error } = await sb
        .from("workouts")
        .select("id, workout_date, title, notes, workout_format, rounds, score_type, warmup_notes, cardio_notes, workout_exercises (id, exercise_name, sets, reps, target, target_weight, benchmark_key, benchmark_name, movement_key, movement_name, section_type, notes, sort_order)")
        .order("workout_date", { ascending: true });

      if (error) throw error;
      return (data || []).map(normalizeWorkout);
    },

    async results() {
      const sb = client();
      if (!sb) return readLocal(localResultKey);

      const { data, error } = await sb
        .from("athlete_workout_results")
        .select("id, workout_exercise_id, completed_on, working_weight, reps_completed, notes, score_result, is_pr, workout_exercises (exercise_name, workout_id, benchmark_key, benchmark_name, movement_key, movement_name)")
        .order("completed_on", { ascending: false })
        .order("created_at", { ascending: false });

      if (error) throw error;
      return (data || []).map(normalizeResult);
    },

    async saveWorkout(workout) {
      const sb = client();
      if (!sb) {
        const workouts = readLocal(localWorkoutKey).filter((item) => item.id !== workout.id);
        workouts.push(workout);
        writeLocal(localWorkoutKey, workouts.sort((a, b) => a.date.localeCompare(b.date)));
        return workout.id;
      }

      const user = await requireUser();
      const payload = {
        workout_date: workout.date,
        title: workout.title,
        notes: workout.notes || null,
        warmup_notes: workout.warmupNotes || null,
        cardio_notes: workout.cardioNotes || null,
        workout_format: workout.format || "Strength",
        rounds: workout.rounds || null,
        score_type: workout.scoreType || null,
        created_by: user?.id || null
      };

      let workoutId = workout.id;
      const existingExerciseIds = new Set();

      if (workoutId) {
        const { error } = await sb.from("workouts").update(payload).eq("id", workoutId);
        if (error) throw error;

        const { data: existingExercises, error: existingError } = await sb
          .from("workout_exercises")
          .select("id")
          .eq("workout_id", workoutId);
        if (existingError) throw existingError;
        (existingExercises || []).forEach((exercise) => existingExerciseIds.add(exercise.id));
      } else {
        const { data, error } = await sb.from("workouts").insert(payload).select("id").single();
        if (error) throw error;
        workoutId = data.id;
      }

      const keptExerciseIds = new Set();
      for (const [index, exercise] of workout.exercises.entries()) {
        const exercisePayload = {
          workout_id: workoutId,
          exercise_name: exercise.name,
          sets: exercise.sets || null,
          reps: exercise.reps || null,
          target: exercise.target || null,
          target_weight: exercise.weight || null,
          benchmark_key: exercise.benchmarkKey || null,
          benchmark_name: exercise.benchmarkName || null,
          movement_key: exercise.movementKey || null,
          movement_name: exercise.movementName || null,
          section_type: exercise.section || "cardio",
          notes: exercise.notes || null,
          sort_order: index
        };

        if (isUuid(exercise.id) && existingExerciseIds.has(exercise.id)) {
          keptExerciseIds.add(exercise.id);
          const { error } = await sb.from("workout_exercises").update(exercisePayload).eq("id", exercise.id);
          if (error) throw error;
        } else {
          const { data, error } = await sb.from("workout_exercises").insert(exercisePayload).select("id").single();
          if (error) throw error;
          keptExerciseIds.add(data.id);
        }
      }

      const removedExerciseIds = [...existingExerciseIds].filter((id) => !keptExerciseIds.has(id));
      if (removedExerciseIds.length) {
        const { error } = await sb.from("workout_exercises").delete().in("id", removedExerciseIds);
        if (error) throw error;
      }
      return workoutId;
    },

    async deleteWorkout(id) {
      const sb = client();
      if (!sb) {
        writeLocal(localWorkoutKey, readLocal(localWorkoutKey).filter((item) => item.id !== id));
        return;
      }
      const { error } = await sb.from("workouts").delete().eq("id", id);
      if (error) throw error;
    },

    async saveResult(result) {
      const sb = client();
      if (!sb) {
        const results = readLocal(localResultKey).filter((item) => item.id !== result.id);
        results.push(result);
        writeLocal(localResultKey, results.sort((a, b) => b.completedOn.localeCompare(a.completedOn)));
        return;
      }

      const user = await requireUser();
      const { error } = await sb.from("athlete_workout_results").insert({
        auth_user_id: user?.id || null,
        workout_exercise_id: result.exerciseId,
        completed_on: result.completedOn,
        working_weight: result.weight || null,
        reps_completed: result.reps || null,
        notes: result.notes || null,
        score_result: result.score || null,
        is_pr: result.isPr
      });
      if (error) throw error;
    }
  };
})();

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function escapeHtml(value) {
  return String(value || "").replace(/[&<>'"]/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;"
  }[char]));
}

function uid(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

const defaultWarmupTemplates = [
  {
    key: "pushup-ringrow",
    name: "Push-up + Ring Row",
    notes: "3 rounds: alternate 5 push-ups and 8 ring rows. Move smooth, not for time."
  },
  {
    key: "general-dynamic",
    name: "General Dynamic Warm-up",
    notes: "2 rounds: 10 air squats, 10 lunges, 10 band pull-aparts, 20 jumping jacks. Then easy movement prep for today’s workout."
  },
  {
    key: "row-mobility",
    name: "Row + Mobility",
    notes: "5 min easy row, then 2 rounds: 10 pass-throughs, 10 inchworms, 10 glute bridges, 10 scap pull-ups."
  },
  {
    key: "barbell-prep",
    name: "Barbell Prep",
    notes: "With empty bar: 2 rounds of 5 good mornings, 5 front squats, 5 strict press, 5 RDL, 5 hang power cleans."
  }
];

let warmupTemplates = [...defaultWarmupTemplates];

function warmupTemplateOptions(selectedId = "") {
  return warmupTemplates.map((template) => `<option value="${escapeHtml(template.id || template.key)}"${(template.id || template.key) === selectedId ? " selected" : ""}>${escapeHtml(template.name)}</option>`).join("");
}

function warmupTemplateByKey(key) {
  return warmupTemplates.find((template) => (template.id || template.key) === key);
}

const defaultStrengthMovements = [
  { key: "", name: "Select movement" },
  { key: "back-squat", name: "Back Squat" },
  { key: "front-squat", name: "Front Squat" },
  { key: "deadlift", name: "Deadlift" },
  { key: "bench-press", name: "Bench Press" },
  { key: "incline-db-chest-press", name: "Incline DB Chest Press" },
  { key: "strict-press", name: "Strict Press" },
  { key: "push-press", name: "Push Press" },
  { key: "power-clean", name: "Power Clean" },
  { key: "squat-clean", name: "Squat Clean" },
  { key: "power-snatch", name: "Power Snatch" },
  { key: "squat-snatch", name: "Squat Snatch" },
  { key: "clean-and-jerk", name: "Clean & Jerk" },
  { key: "pull-up", name: "Pull-up" },
  { key: "ring-row", name: "Ring Row" },
  { key: "push-up", name: "Push-up" },
  { key: "kettlebell-swing", name: "Kettlebell Swing" },
  { key: "custom", name: "Custom / one-off" }
];

let strengthMovements = [...defaultStrengthMovements];

function movementId(movement) {
  return movement.id || movement.movement_key || movement.key || "";
}

function strengthMovementByKey(key) {
  if (!key) return null;
  return strengthMovements.find((movement) => movementId(movement) === key) || null;
}

function movementInputValue(values = {}, selectedMovement = "") {
  if (values.name) return values.name;
  if (values.movementName) return values.movementName;
  const movement = strengthMovementByKey(selectedMovement);
  if (!movement || movement.key === "custom" || movement.name === "Select movement") return "";
  return movement.name;
}

function strengthMovementOptions(selectedKey = "") {
  return strengthMovements.map((movement) => `<option value="${escapeHtml(movementId(movement))}"${movementId(movement) === selectedKey ? " selected" : ""}>${escapeHtml(movement.name)}</option>`).join("");
}

function strengthMovementDatalistOptions() {
  return strengthMovements
    .filter((movement) => movementId(movement) && movementId(movement) !== "custom")
    .map((movement) => `<option value="${escapeHtml(movement.name)}"></option>`)
    .join("");
}

function strengthMovementByName(name) {
  const normalized = String(name || "").trim().toLowerCase();
  return strengthMovements.find((movement) => movement.name.toLowerCase() === normalized);
}

const defaultCardioBenchmarks = [
  { key: "", name: "Select benchmark" },
  { key: "4k-row", name: "4K Row", scoreType: "Time", description: "For time: row 4,000 meters. Record finish time." },
  { key: "2k-row", name: "2K Row", scoreType: "Time", description: "For time: row 2,000 meters. Record finish time." },
  { key: "1-mile-run", name: "1 Mile Run", scoreType: "Time" },
  { key: "5k-run", name: "5K Run", scoreType: "Time" },
  { key: "assault-bike-calories", name: "Assault Bike Calories", scoreType: "Calories" },
  { key: "ski-erg-calories", name: "SkiErg Calories", scoreType: "Calories" },
  { key: "cindy", name: "Cindy", scoreType: "Rounds + reps", description: "20 min AMRAP: 5 pull-ups, 10 push-ups, 15 air squats." },
  { key: "murph", name: "Murph", scoreType: "Time", description: "For time: 1 mile run, 100 pull-ups, 200 push-ups, 300 air squats, 1 mile run. Partition reps as needed. Vest optional." },
  { key: "fran", name: "Fran", scoreType: "Time", description: "21-15-9 reps for time: thrusters and pull-ups." },
  { key: "helen", name: "Helen", scoreType: "Time", description: "3 rounds for time: 400m run, 21 kettlebell swings, 12 pull-ups." },
  { key: "annie", name: "Annie", scoreType: "Time", description: "50-40-30-20-10 reps for time: double-unders and sit-ups." },
  { key: "grace", name: "Grace", scoreType: "Time", description: "For time: 30 clean and jerks." },
  { key: "custom", name: "Custom / one-off", scoreType: "" }
];

let cardioBenchmarks = [...defaultCardioBenchmarks];

function benchmarkId(benchmark) {
  return benchmark.id || benchmark.benchmark_key || benchmark.key || "";
}

function benchmarkScoreType(benchmark) {
  return benchmark?.score_type || benchmark?.scoreType || "";
}

function benchmarkByKey(key) {
  if (!key) return cardioBenchmarks[0];
  return cardioBenchmarks.find((benchmark) => benchmarkId(benchmark) === key) || cardioBenchmarks[0];
}

function benchmarkOptions(selectedKey = "") {
  return cardioBenchmarks.map((benchmark) => `<option value="${escapeHtml(benchmarkId(benchmark))}"${benchmarkId(benchmark) === selectedKey ? " selected" : ""}>${escapeHtml(benchmark.name)}</option>`).join("");
}

function friendlyError(error) {
  const message = error?.message || String(error || "Something went wrong.");
  if (message.includes("relation") && message.includes("does not exist")) {
    return "Supabase tables are not created yet. Apply supabase/schema-draft.sql in the Supabase SQL editor.";
  }
  return message;
}

function exerciseSummary(exercise) {
  const parts = [];
  if (exercise.sets) parts.push(`${escapeHtml(exercise.sets)} sets`);
  if (exercise.reps) parts.push(`${escapeHtml(exercise.reps)} reps`);
  if (exercise.weight) parts.push(escapeHtml(exercise.weight));
  if (exercise.target) parts.push(escapeHtml(exercise.target));
  return parts.join(" · ");
}

function parseLocalDate(value) {
  const [year, month, day] = String(value || "").split("-").map(Number);
  return new Date(year || 1970, (month || 1) - 1, day || 1);
}

function isoDate(dateValue) {
  const date = new Date(dateValue);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function startOfWeek(dateValue) {
  const date = new Date(dateValue);
  date.setHours(0, 0, 0, 0);
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + diff);
  return date;
}

function addDays(dateValue, days) {
  const date = new Date(dateValue);
  date.setDate(date.getDate() + days);
  return date;
}

function shortDate(dateValue) {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(dateValue);
}

function workoutSearchText(workout) {
  return [
    workout.title,
    workout.date,
    workout.notes,
    workout.warmupNotes,
    workout.cardioNotes,
    ...workout.exercises.flatMap((exercise) => [exercise.name, exercise.notes, exercise.target, exercise.benchmarkName, exercise.movementName])
  ].join(" ").toLowerCase();
}

function initCoachApp() {
  const form = document.getElementById("workoutForm");
  if (!form) return;

  const date = document.getElementById("workoutDate");
  const title = document.getElementById("workoutTitle");
  const notes = document.getElementById("workoutNotes");
  const warmupTemplate = document.getElementById("warmupTemplate");
  const warmupTemplateName = document.getElementById("warmupTemplateName");
  const saveWarmupTemplateBtn = document.getElementById("saveWarmupTemplateBtn");
  const updateWarmupTemplateBtn = document.getElementById("updateWarmupTemplateBtn");
  const deleteWarmupTemplateBtn = document.getElementById("deleteWarmupTemplateBtn");
  const movementManagerSelect = document.getElementById("movementManagerSelect");
  const movementManagerName = document.getElementById("movementManagerName");
  const saveMovementBtn = document.getElementById("saveMovementBtn");
  const updateMovementBtn = document.getElementById("updateMovementBtn");
  const deleteMovementBtn = document.getElementById("deleteMovementBtn");
  const benchmarkManagerSelect = document.getElementById("benchmarkManagerSelect");
  const benchmarkManagerName = document.getElementById("benchmarkManagerName");
  const benchmarkManagerScoreType = document.getElementById("benchmarkManagerScoreType");
  const benchmarkManagerDescription = document.getElementById("benchmarkManagerDescription");
  const saveBenchmarkBtn = document.getElementById("saveBenchmarkBtn");
  const updateBenchmarkBtn = document.getElementById("updateBenchmarkBtn");
  const deleteBenchmarkBtn = document.getElementById("deleteBenchmarkBtn");
  const warmupNotes = document.getElementById("warmupNotes");
  const cardioNotes = document.getElementById("cardioNotes");
  const sectionRows = [...document.querySelectorAll("[data-exercise-rows]")];
  const list = document.getElementById("coachWorkoutList");
  const resultsList = document.getElementById("coachResultsList");
  const count = document.getElementById("workoutCount");
  const weekLabel = document.getElementById("workoutWeekLabel");
  const workoutSearch = document.getElementById("workoutSearch");
  const prevWeekBtn = document.getElementById("prevWeekBtn");
  const thisWeekBtn = document.getElementById("thisWeekBtn");
  const nextWeekBtn = document.getElementById("nextWeekBtn");
  const message = document.getElementById("coachAppMessage");
  let selectedWeekStart = startOfWeek(new Date());

  date.value = todayISO();

  function setAppMessage(text, isError = false) {
    message.textContent = text || "";
    message.classList.toggle("hidden", !text);
    message.classList.toggle("error-text", Boolean(isError));
  }

  function renderWarmupTemplateOptions(selectedId = "") {
    if (!warmupTemplate) return;
    warmupTemplate.innerHTML = `<option value="">Custom warm-up</option>${warmupTemplateOptions(selectedId)}`;
  }

  async function loadWarmupTemplates() {
    try {
      const savedTemplates = await MangoFitnessStore.warmupTemplates();
      warmupTemplates = savedTemplates.length ? savedTemplates : [...defaultWarmupTemplates];
      renderWarmupTemplateOptions();
    } catch (error) {
      warmupTemplates = [...defaultWarmupTemplates];
      renderWarmupTemplateOptions();
      setAppMessage(friendlyError(error), true);
    }
  }

  function renderMovementManagerOptions(selectedId = "") {
    if (!movementManagerSelect) return;
    movementManagerSelect.innerHTML = `<option value="">New movement</option>${strengthMovementOptions(selectedId)}`;
  }

  function ensureStrengthMovementDatalist() {
    let datalist = document.getElementById("strengthMovementOptions");
    if (!datalist) {
      datalist = document.createElement("datalist");
      datalist.id = "strengthMovementOptions";
      document.body.appendChild(datalist);
    }
    datalist.innerHTML = strengthMovementDatalistOptions();
  }

  function refreshMovementDropdowns() {
    ensureStrengthMovementDatalist();
    document.querySelectorAll(".exercise-movement").forEach((input) => {
      const selected = strengthMovementByKey(input.dataset.movementKey || "");
      if (selected?.name && selected.name !== "Select movement" && !input.value) input.value = selected.name;
    });
  }

  async function loadStrengthMovements() {
    try {
      const savedMovements = await MangoFitnessStore.strengthMovements();
      strengthMovements = savedMovements.length ? [{ key: "", name: "Select movement" }, ...savedMovements, { key: "custom", name: "Custom / one-off" }] : [...defaultStrengthMovements];
      renderMovementManagerOptions();
      refreshMovementDropdowns();
    } catch (error) {
      strengthMovements = [...defaultStrengthMovements];
      renderMovementManagerOptions();
      refreshMovementDropdowns();
      setAppMessage(friendlyError(error), true);
    }
  }

  function renderBenchmarkManagerOptions(selectedId = "") {
    if (!benchmarkManagerSelect) return;
    benchmarkManagerSelect.innerHTML = `<option value="">New benchmark</option>${benchmarkOptions(selectedId)}`;
  }

  function refreshBenchmarkDropdowns() {
    document.querySelectorAll(".exercise-benchmark").forEach((select) => {
      const selected = select.value;
      select.innerHTML = benchmarkOptions(selected);
    });
  }

  async function loadCardioBenchmarks() {
    try {
      const savedBenchmarks = await MangoFitnessStore.cardioBenchmarks();
      cardioBenchmarks = savedBenchmarks.length ? [{ key: "", name: "Select benchmark" }, ...savedBenchmarks, { key: "custom", name: "Custom / one-off", scoreType: "" }] : [...defaultCardioBenchmarks];
      renderBenchmarkManagerOptions();
      refreshBenchmarkDropdowns();
    } catch (error) {
      cardioBenchmarks = [...defaultCardioBenchmarks];
      renderBenchmarkManagerOptions();
      refreshBenchmarkDropdowns();
      setAppMessage(friendlyError(error), true);
    }
  }

  const sectionLabels = {
    warmup: "Warm-up",
    lifting: "Weightlifting / Strength",
    cardio: "Cardio / WOD",
    partner: "Partner WOD"
  };

  function rowsForSection(section) {
    return document.querySelector(`[data-exercise-rows="${section}"]`);
  }

  function addExerciseRow(section = "cardio", values = {}) {
    const rows = rowsForSection(section);
    if (!rows) return;
    const row = document.createElement("div");
    row.className = "exercise-row exercise-table-row";
    row.dataset.exerciseId = values.id || uid("exercise");
    row.dataset.section = section;
    row.draggable = true;
    const selectedBenchmark = values.benchmarkKey || "";
    const selectedMovement = values.movementKey || "";
    const rowFields = section === "cardio" ? `
      <div class="field benchmark-field"><label>Benchmark map</label><select class="exercise-benchmark">${benchmarkOptions(selectedBenchmark)}</select></div>
      <input class="exercise-name" type="hidden" value="${escapeHtml(values.name || values.benchmarkName || "Cardio score")}" />
      <div class="field target-field"><label>Score type</label><input class="exercise-target" type="text" placeholder="Time, calories, meters, rounds + reps" value="${escapeHtml(values.target)}" /></div>
      <div class="field notes-field"><label>Description / notes</label><input class="exercise-notes" type="text" placeholder="Workout description or what the athlete should record" value="${escapeHtml(values.notes)}" /></div>
    ` : `
      ${section === "lifting" ? `<div class="field exercise-name-field movement-map-field"><label>Movement</label><input class="exercise-name exercise-movement" data-movement-key="${escapeHtml(selectedMovement)}" placeholder="Start typing, e.g. chest" value="${escapeHtml(movementInputValue(values, selectedMovement))}" autocomplete="off" required /><div class="movement-suggestions hidden"></div></div>` : `<div class="field exercise-name-field"><label>Movement / station</label><input class="exercise-name" type="text" placeholder="Row, Back squat, Station 1" value="${escapeHtml(values.name)}" required /></div>`}
      <div class="field compact-field"><label>Sets</label><input class="exercise-sets" type="text" placeholder="4" value="${escapeHtml(values.sets)}" /></div>
      <div class="field compact-field"><label>Reps</label><input class="exercise-reps" type="text" placeholder="500m + 5" value="${escapeHtml(values.reps)}" /></div>
      <div class="field compact-field"><label>Weight</label><input class="exercise-weight" type="text" placeholder="53/35 lb" value="${escapeHtml(values.weight)}" /></div>
      <div class="field target-field"><label>Target</label><input class="exercise-target" type="text" placeholder="RPE, pace, or goal" value="${escapeHtml(values.target)}" /></div>
      <div class="field notes-field"><label>Notes</label><input class="exercise-notes" type="text" placeholder="Coaching notes or scaling" value="${escapeHtml(values.notes)}" /></div>
    `;
    row.innerHTML = `
      <button type="button" class="drag-handle" aria-label="Drag to reorder" title="Drag to reorder">☰</button>
      <button type="button" class="move-row move-up" aria-label="Move up" title="Move up">↑</button>
      <button type="button" class="move-row move-down" aria-label="Move down" title="Move down">↓</button>
      ${rowFields}
      <button type="button" class="remove-row">Remove</button>
    `;
    row.querySelector(".remove-row").addEventListener("click", () => row.remove());
    row.querySelector(".exercise-benchmark")?.addEventListener("change", (event) => {
      const benchmark = benchmarkByKey(event.target.value);
      const nameInput = row.querySelector(".exercise-name");
      const targetInput = row.querySelector(".exercise-target");
      const notesInput = row.querySelector(".exercise-notes");
      if (benchmarkId(benchmark) && benchmarkId(benchmark) !== "custom") nameInput.value = benchmark.name;
      else if (!nameInput.value.trim()) nameInput.value = "Cardio score";
      if (benchmarkScoreType(benchmark)) targetInput.value = benchmarkScoreType(benchmark);
      if (benchmark.description && !notesInput.value.trim()) notesInput.value = benchmark.description;
    });
    const movementInput = row.querySelector(".exercise-movement");
    const suggestionBox = row.querySelector(".movement-suggestions");
    if (suggestionBox && suggestionBox.parentElement !== document.body) {
      document.body.appendChild(suggestionBox);
    }
    function hideMovementSuggestions() {
      suggestionBox?.classList.add("hidden");
    }
    function positionMovementSuggestions() {
      if (!movementInput || !suggestionBox || suggestionBox.classList.contains("hidden")) return;
      const box = movementInput.getBoundingClientRect();
      const viewport = window.visualViewport;
      const offsetLeft = viewport?.offsetLeft || 0;
      const offsetTop = viewport?.offsetTop || 0;
      const viewportWidth = viewport?.width || window.innerWidth;
      const viewportHeight = viewport?.height || window.innerHeight;
      const suggestionHeight = Math.min(220, suggestionBox.scrollHeight || 160);
      const left = Math.max(8 + offsetLeft, Math.min(box.left + offsetLeft, viewportWidth + offsetLeft - box.width - 8));
      let top = box.bottom + offsetTop + 4;
      if (top + suggestionHeight > viewportHeight + offsetTop - 8) {
        top = Math.max(8 + offsetTop, box.top + offsetTop - suggestionHeight - 4);
      }
      suggestionBox.style.left = `${left}px`;
      suggestionBox.style.top = `${top}px`;
      suggestionBox.style.width = `${Math.min(box.width, viewportWidth - 16)}px`;
      suggestionBox.style.maxHeight = `${suggestionHeight}px`;
    }
    function applyMovement(movement) {
      if (!movementInput || !movement) return;
      movementInput.value = movement.name;
      movementInput.dataset.movementKey = movementId(movement);
      hideMovementSuggestions();
    }
    movementInput?.addEventListener("input", (event) => {
      const query = event.target.value.trim().toLowerCase();
      const exactMovement = strengthMovementByName(event.target.value);
      event.target.dataset.movementKey = exactMovement ? movementId(exactMovement) : "";
      if (!suggestionBox) return;
      const matches = query ? strengthMovements
        .filter((movement) => movementId(movement) && movementId(movement) !== "custom" && movement.name.toLowerCase().includes(query))
        .slice(0, 8) : [];
      suggestionBox.innerHTML = matches.map((movement) => `<button type="button" data-movement-id="${escapeHtml(movementId(movement))}">${escapeHtml(movement.name)}</button>`).join("");
      suggestionBox.classList.toggle("hidden", !matches.length);
      if (matches.length) positionMovementSuggestions();
    });
    suggestionBox?.addEventListener("click", (event) => {
      const button = event.target.closest("[data-movement-id]");
      if (!button) return;
      applyMovement(strengthMovementByKey(button.dataset.movementId));
    });
    movementInput?.addEventListener("blur", () => setTimeout(hideMovementSuggestions, 150));
    movementInput?.addEventListener("focus", () => movementInput.dispatchEvent(new Event("input")));
    window.addEventListener("scroll", positionMovementSuggestions, true);
    window.addEventListener("resize", positionMovementSuggestions);
    window.visualViewport?.addEventListener("resize", positionMovementSuggestions);
    window.visualViewport?.addEventListener("scroll", positionMovementSuggestions);
    row.querySelector(".move-up").addEventListener("click", () => row.previousElementSibling?.before(row));
    row.querySelector(".move-down").addEventListener("click", () => row.nextElementSibling?.after(row));
    rows.appendChild(row);
  }

  function exercisesBySection(exercises) {
    return Object.keys(sectionLabels).map((section) => ({
      section,
      label: sectionLabels[section],
      exercises: exercises.filter((exercise) => (exercise.section || "cardio") === section)
    })).filter((group) => group.exercises.length);
  }

  function renderExerciseGroups(exercises) {
    const groups = exercisesBySection(exercises);
    if (!groups.length) return "";
    return groups.map((group) => `
      <div class="exercise-group">
        <h4>${escapeHtml(group.label)}</h4>
        <ul class="clean-list">${group.exercises.map((exercise) => `<li><strong>${escapeHtml(exercise.name)}</strong>${exerciseSummary(exercise) ? ` — ${exerciseSummary(exercise)}` : ""}</li>`).join("")}</ul>
      </div>
    `).join("");
  }

  function rowAfterPointer(container, y) {
    const draggableRows = [...container.querySelectorAll(".exercise-row:not(.dragging)")];
    return draggableRows.reduce((closest, child) => {
      const box = child.getBoundingClientRect();
      const offset = y - box.top - box.height / 2;
      if (offset < 0 && offset > closest.offset) return { offset, element: child };
      return closest;
    }, { offset: Number.NEGATIVE_INFINITY, element: null }).element;
  }

  function enableRowSorting(rows) {
    rows.addEventListener("dragstart", (event) => {
      const row = event.target.closest(".exercise-row");
      if (!row) return;
      row.classList.add("dragging");
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("text/plain", row.dataset.exerciseId);
    });

    rows.addEventListener("dragend", (event) => {
      event.target.closest(".exercise-row")?.classList.remove("dragging");
    });

    rows.addEventListener("dragover", (event) => {
      event.preventDefault();
      const dragging = rows.querySelector(".dragging");
      if (!dragging) return;
      const after = rowAfterPointer(rows, event.clientY);
      if (after) rows.insertBefore(dragging, after);
      else rows.appendChild(dragging);
    });

    rows.addEventListener("pointerdown", (event) => {
      const handle = event.target.closest(".drag-handle");
      if (!handle) return;
      const row = handle.closest(".exercise-row");
      if (!row) return;

      event.preventDefault();
      row.classList.add("dragging");
      document.body.classList.add("is-reordering");

      function move(pointerEvent) {
        pointerEvent.preventDefault();
        const after = rowAfterPointer(rows, pointerEvent.clientY);
        if (after) rows.insertBefore(row, after);
        else rows.appendChild(row);
      }

      function stop() {
        row.classList.remove("dragging");
        document.body.classList.remove("is-reordering");
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", stop);
        window.removeEventListener("pointercancel", stop);
      }

      window.addEventListener("pointermove", move, { passive: false });
      window.addEventListener("pointerup", stop, { once: true });
      window.addEventListener("pointercancel", stop, { once: true });
    });
  }

  sectionRows.forEach(enableRowSorting);

  function clearForm() {
    form.dataset.editId = "";
    date.value = todayISO();
    title.value = "";
    notes.value = "";
    if (warmupTemplate) warmupTemplate.value = "";
    if (warmupTemplateName) warmupTemplateName.value = "";
    warmupNotes.value = "";
    cardioNotes.value = "";
    sectionRows.forEach((rowContainer) => { rowContainer.innerHTML = ""; });
    addExerciseRow("lifting");
    addExerciseRow("cardio");
    setAppMessage("");
  }

  function collectExercises() {
    return sectionRows.flatMap((rowContainer) => [...rowContainer.querySelectorAll(".exercise-row")]).map((row) => ({
      id: row.dataset.exerciseId,
      section: row.dataset.section || row.closest("[data-exercise-rows]")?.dataset.exerciseRows || "cardio",
      benchmarkKey: row.querySelector(".exercise-benchmark")?.value || "",
      benchmarkName: benchmarkByKey(row.querySelector(".exercise-benchmark")?.value || "").name.replace("Select benchmark", "").replace("Custom / one-off", ""),
      movementKey: row.querySelector(".exercise-movement")?.dataset.movementKey || movementId(strengthMovementByName(row.querySelector(".exercise-movement")?.value || "") || {}) || "",
      movementName: strengthMovementByName(row.querySelector(".exercise-movement")?.value || "")?.name || "",
      name: row.querySelector(".exercise-name").value.trim(),
      sets: row.querySelector(".exercise-sets")?.value.trim() || "",
      reps: row.querySelector(".exercise-reps")?.value.trim() || "",
      target: row.querySelector(".exercise-target")?.value.trim() || "",
      weight: row.querySelector(".exercise-weight")?.value.trim() || "",
      notes: row.querySelector(".exercise-notes")?.value.trim() || ""
    })).filter((exercise) => exercise.name);
  }

  async function editWorkout(id) {
    const workout = (await MangoFitnessStore.workouts()).find((item) => item.id === id);
    if (!workout) return;
    form.dataset.editId = workout.id;
    date.value = workout.date;
    title.value = workout.title;
    notes.value = workout.notes || "";
    warmupNotes.value = workout.warmupNotes || "";
    cardioNotes.value = workout.cardioNotes || "";
    sectionRows.forEach((rowContainer) => { rowContainer.innerHTML = ""; });
    workout.exercises.forEach((exercise) => addExerciseRow(exercise.section || "cardio", exercise));
    window.scrollTo({ top: form.offsetTop - 20, behavior: "smooth" });
  }

  async function copyWorkout(id) {
    const workout = (await MangoFitnessStore.workouts()).find((item) => item.id === id);
    if (!workout) return;
    form.dataset.editId = "";
    date.value = todayISO();
    title.value = `${workout.title} copy`;
    notes.value = workout.notes || "";
    warmupNotes.value = workout.warmupNotes || "";
    cardioNotes.value = workout.cardioNotes || "";
    sectionRows.forEach((rowContainer) => { rowContainer.innerHTML = ""; });
    workout.exercises.forEach((exercise) => addExerciseRow(exercise.section || "cardio", { ...exercise, id: "" }));
    setAppMessage("Workout copied into the builder. Pick a date and save it.");
    window.scrollTo({ top: form.offsetTop - 20, behavior: "smooth" });
  }

  async function renderCoach() {
    try {
      const workouts = await MangoFitnessStore.workouts();
      const results = await MangoFitnessStore.results();
      const searchQuery = workoutSearch?.value.trim().toLowerCase() || "";
      const weekStart = selectedWeekStart;
      const weekEnd = addDays(weekStart, 6);
      const visibleWorkouts = workouts.filter((workout) => {
        if (searchQuery) return workoutSearchText(workout).includes(searchQuery);
        const workoutDate = parseLocalDate(workout.date);
        return workoutDate >= weekStart && workoutDate <= weekEnd;
      });

      count.textContent = searchQuery
        ? `${visibleWorkouts.length} match${visibleWorkouts.length === 1 ? "" : "es"}`
        : `${visibleWorkouts.length} this week`;
      if (weekLabel) {
        weekLabel.textContent = searchQuery
          ? "Search results"
          : `Week of ${shortDate(weekStart)} – ${shortDate(weekEnd)}`;
      }

      list.innerHTML = visibleWorkouts.length ? visibleWorkouts.map((workout) => `
        <article class="item-card">
          <div class="item-head">
            <div><strong>${escapeHtml(workout.title)}</strong><p class="muted">${escapeHtml(workout.date)} · ${workout.exercises.length} items</p></div>
            <div class="actions item-actions">
              <button type="button" data-edit="${workout.id}">Edit</button>
              <button type="button" data-copy="${workout.id}">Copy</button>
              <button type="button" data-delete="${workout.id}">Delete</button>
            </div>
          </div>
          ${workout.notes ? `<p>${escapeHtml(workout.notes)}</p>` : ""}
          ${workout.warmupNotes ? `<div class="exercise-group"><h4>Warm-up</h4><p>${escapeHtml(workout.warmupNotes)}</p></div>` : ""}
          ${workout.cardioNotes ? `<div class="exercise-group"><h4>Cardio / WOD</h4><p>${escapeHtml(workout.cardioNotes)}</p></div>` : ""}
          ${renderExerciseGroups(workout.exercises)}
        </article>
      `).join("") : `<p class="muted empty-state">${searchQuery ? "No workouts matched your search." : "No workouts saved for this week."}</p>`;

      resultsList.innerHTML = results.length ? results.map((result) => `
        <article class="item-card">
          <strong>${escapeHtml(result.exerciseName)}</strong>
          <p class="muted">${escapeHtml(result.completedOn)}${result.score ? ` · Score: ${escapeHtml(result.score)}` : ""} · ${escapeHtml(result.weight || "-")} lb · ${escapeHtml(result.reps || "-")} reps${result.isPr ? " · PR" : ""}</p>
          ${result.notes ? `<p>${escapeHtml(result.notes)}</p>` : ""}
        </article>
      `).join("") : `<p class="muted empty-state">No athlete results logged yet.</p>`;

      list.querySelectorAll("[data-edit]").forEach((button) => button.addEventListener("click", () => editWorkout(button.dataset.edit).catch((error) => setAppMessage(friendlyError(error), true))));
      list.querySelectorAll("[data-copy]").forEach((button) => button.addEventListener("click", () => copyWorkout(button.dataset.copy).catch((error) => setAppMessage(friendlyError(error), true))));
      list.querySelectorAll("[data-delete]").forEach((button) => button.addEventListener("click", async () => {
        const workoutTitle = button.closest(".item-card")?.querySelector("strong")?.textContent || "this workout";
        if (!confirm(`Delete ${workoutTitle}? This cannot be undone.`)) return;
        try {
          await MangoFitnessStore.deleteWorkout(button.dataset.delete);
          await renderCoach();
        } catch (error) {
          setAppMessage(friendlyError(error), true);
        }
      }));
    } catch (error) {
      count.textContent = "0 workouts";
      list.innerHTML = `<p class="muted empty-state">${escapeHtml(friendlyError(error))}</p>`;
      resultsList.innerHTML = `<p class="muted empty-state">Results unavailable until Supabase is ready.</p>`;
    }
  }

  prevWeekBtn?.addEventListener("click", () => {
    selectedWeekStart = addDays(selectedWeekStart, -7);
    if (workoutSearch) workoutSearch.value = "";
    renderCoach();
  });
  thisWeekBtn?.addEventListener("click", () => {
    selectedWeekStart = startOfWeek(new Date());
    if (workoutSearch) workoutSearch.value = "";
    renderCoach();
  });
  nextWeekBtn?.addEventListener("click", () => {
    selectedWeekStart = addDays(selectedWeekStart, 7);
    if (workoutSearch) workoutSearch.value = "";
    renderCoach();
  });
  workoutSearch?.addEventListener("input", renderCoach);

  warmupTemplate?.addEventListener("change", () => {
    const template = warmupTemplateByKey(warmupTemplate.value);
    warmupTemplateName.value = template?.name || "";
    if (template) warmupNotes.value = template.notes;
  });

  saveWarmupTemplateBtn?.addEventListener("click", async () => {
    const name = warmupTemplateName.value.trim();
    const templateNotes = warmupNotes.value.trim();
    if (!name || !templateNotes) return setAppMessage("Add a template name and warm-up notes first.", true);
    try {
      const saved = await MangoFitnessStore.saveWarmupTemplate({ name, notes: templateNotes });
      await loadWarmupTemplates();
      renderWarmupTemplateOptions(saved.id);
      setAppMessage("Warm-up template saved.");
    } catch (error) {
      setAppMessage(friendlyError(error), true);
    }
  });

  updateWarmupTemplateBtn?.addEventListener("click", async () => {
    const id = warmupTemplate.value;
    const name = warmupTemplateName.value.trim();
    const templateNotes = warmupNotes.value.trim();
    const selected = warmupTemplateByKey(id);
    if (!id || !selected?.id) return setAppMessage("Select a template to update.", true);
    if (!name || !templateNotes) return setAppMessage("Add a template name and warm-up notes first.", true);
    try {
      await MangoFitnessStore.updateWarmupTemplate(id, { name, notes: templateNotes });
      await loadWarmupTemplates();
      renderWarmupTemplateOptions(id);
      setAppMessage("Warm-up template updated.");
    } catch (error) {
      setAppMessage(friendlyError(error), true);
    }
  });

  deleteWarmupTemplateBtn?.addEventListener("click", async () => {
    const id = warmupTemplate.value;
    const selected = warmupTemplateByKey(id);
    if (!id || !selected?.id) return setAppMessage("Select a template to delete.", true);
    if (!confirm(`Delete warm-up template “${selected.name}”? This cannot be undone.`)) return;
    try {
      await MangoFitnessStore.deleteWarmupTemplate(id);
      await loadWarmupTemplates();
      warmupTemplateName.value = "";
      warmupNotes.value = "";
      setAppMessage("Warm-up template deleted.");
    } catch (error) {
      setAppMessage(friendlyError(error), true);
    }
  });

  movementManagerSelect?.addEventListener("change", () => {
    const movement = strengthMovementByKey(movementManagerSelect.value);
    movementManagerName.value = movement?.name || "";
  });

  saveMovementBtn?.addEventListener("click", async () => {
    const name = movementManagerName.value.trim();
    if (!name) return setAppMessage("Add a movement name first.", true);
    try {
      const saved = await MangoFitnessStore.saveStrengthMovement({ name });
      await loadStrengthMovements();
      renderMovementManagerOptions(saved.id);
      setAppMessage("Strength movement saved.");
    } catch (error) {
      setAppMessage(friendlyError(error), true);
    }
  });

  updateMovementBtn?.addEventListener("click", async () => {
    const id = movementManagerSelect.value;
    const movement = strengthMovementByKey(id);
    const name = movementManagerName.value.trim();
    if (!id || !movement?.id) return setAppMessage("Select a movement to update.", true);
    if (!name) return setAppMessage("Add a movement name first.", true);
    try {
      await MangoFitnessStore.updateStrengthMovement(id, { name });
      await loadStrengthMovements();
      renderMovementManagerOptions(id);
      setAppMessage("Strength movement updated.");
    } catch (error) {
      setAppMessage(friendlyError(error), true);
    }
  });

  deleteMovementBtn?.addEventListener("click", async () => {
    const id = movementManagerSelect.value;
    const movement = strengthMovementByKey(id);
    if (!id || !movement?.id) return setAppMessage("Select a movement to delete.", true);
    if (!confirm(`Delete strength movement “${movement.name}”? This cannot be undone.`)) return;
    try {
      await MangoFitnessStore.deleteStrengthMovement(id);
      await loadStrengthMovements();
      movementManagerName.value = "";
      setAppMessage("Strength movement deleted.");
    } catch (error) {
      setAppMessage(friendlyError(error), true);
    }
  });

  benchmarkManagerSelect?.addEventListener("change", () => {
    const benchmark = benchmarkByKey(benchmarkManagerSelect.value);
    benchmarkManagerName.value = benchmark?.name?.replace("Select benchmark", "").replace("Custom / one-off", "") || "";
    benchmarkManagerScoreType.value = benchmarkScoreType(benchmark);
    benchmarkManagerDescription.value = benchmark?.description || "";
  });

  saveBenchmarkBtn?.addEventListener("click", async () => {
    const name = benchmarkManagerName.value.trim();
    const scoreType = benchmarkManagerScoreType.value.trim();
    const description = benchmarkManagerDescription.value.trim();
    if (!name) return setAppMessage("Add a benchmark name first.", true);
    try {
      const saved = await MangoFitnessStore.saveCardioBenchmark({ name, scoreType, description });
      await loadCardioBenchmarks();
      renderBenchmarkManagerOptions(saved.id);
      setAppMessage("Cardio benchmark saved.");
    } catch (error) {
      setAppMessage(friendlyError(error), true);
    }
  });

  updateBenchmarkBtn?.addEventListener("click", async () => {
    const id = benchmarkManagerSelect.value;
    const benchmark = benchmarkByKey(id);
    const name = benchmarkManagerName.value.trim();
    const scoreType = benchmarkManagerScoreType.value.trim();
    const description = benchmarkManagerDescription.value.trim();
    if (!id || !benchmark?.id) return setAppMessage("Select a benchmark to update.", true);
    if (!name) return setAppMessage("Add a benchmark name first.", true);
    try {
      await MangoFitnessStore.updateCardioBenchmark(id, { name, scoreType, description });
      await loadCardioBenchmarks();
      renderBenchmarkManagerOptions(id);
      setAppMessage("Cardio benchmark updated.");
    } catch (error) {
      setAppMessage(friendlyError(error), true);
    }
  });

  deleteBenchmarkBtn?.addEventListener("click", async () => {
    const id = benchmarkManagerSelect.value;
    const benchmark = benchmarkByKey(id);
    if (!id || !benchmark?.id) return setAppMessage("Select a benchmark to delete.", true);
    if (!confirm(`Delete cardio benchmark “${benchmark.name}”? This cannot be undone.`)) return;
    try {
      await MangoFitnessStore.deleteCardioBenchmark(id);
      await loadCardioBenchmarks();
      benchmarkManagerName.value = "";
      benchmarkManagerScoreType.value = "";
      benchmarkManagerDescription.value = "";
      setAppMessage("Cardio benchmark deleted.");
    } catch (error) {
      setAppMessage(friendlyError(error), true);
    }
  });

  document.querySelectorAll("[data-add-section]").forEach((button) => {
    button.addEventListener("click", () => addExerciseRow(button.dataset.addSection));
  });
  document.getElementById("clearWorkoutBtn")?.addEventListener("click", clearForm);
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const exercises = collectExercises();
    if (!date.value || !title.value.trim()) return setAppMessage("Add a workout date and title.");
    if (!exercises.length) return setAppMessage("Add at least one exercise.");

    try {
      const savedId = await MangoFitnessStore.saveWorkout({
        id: form.dataset.editId || "",
        date: date.value,
        title: title.value.trim(),
        notes: notes.value.trim(),
        warmupNotes: warmupNotes.value.trim(),
        cardioNotes: cardioNotes.value.trim(),
        format: "Class workout",
        rounds: "",
        scoreType: "",
        exercises
      });
      clearForm();
      setAppMessage(savedId ? "Workout saved to Supabase." : "Workout saved.");
      await renderCoach();
    } catch (error) {
      setAppMessage(friendlyError(error), true);
    }
  });

  loadWarmupTemplates();
  loadStrengthMovements();
  loadCardioBenchmarks();
  clearForm();
  renderCoach();
}

function workoutSectionGroups(exercises) {
  const labels = { warmup: "Warm-up", lifting: "Weightlifting / Strength", cardio: "Cardio / WOD", partner: "Partner WOD" };
  return Object.keys(labels).map((section) => ({
    section,
    label: labels[section],
    exercises: exercises.filter((exercise) => (exercise.section || "cardio") === section)
  })).filter((group) => group.exercises.length);
}

function initAthleteApp() {
  const date = document.getElementById("athleteWorkoutDate");
  const view = document.getElementById("athleteWorkoutView");
  const history = document.getElementById("athleteHistoryList");
  if (!date || !view || !history) return;

  date.value = todayISO();

  async function renderAthlete() {
    try {
      const workouts = await MangoFitnessStore.workouts();
      const workout = workouts.find((item) => item.date === date.value) || workouts[workouts.length - 1];
      const results = await MangoFitnessStore.results();

      if (!workout) {
        view.innerHTML = `<p class="muted empty-state">No workout has been assigned yet.</p>`;
      } else {
        view.innerHTML = `
          <article class="item-card workout-detail">
            <h3>${escapeHtml(workout.title)}</h3>
            <p class="muted">${escapeHtml(workout.date)}</p>
            ${workout.notes ? `<p>${escapeHtml(workout.notes)}</p>` : ""}
            ${workout.warmupNotes ? `<section class="athlete-workout-section"><h4>Warm-up</h4><p>${escapeHtml(workout.warmupNotes)}</p></section>` : ""}
            ${workout.cardioNotes ? `<section class="athlete-workout-section"><h4>Cardio / WOD</h4><p>${escapeHtml(workout.cardioNotes)}</p></section>` : ""}
            <div class="list-stack">
              ${workoutSectionGroups(workout.exercises).map((group) => `
                <section class="athlete-workout-section">
                  <h4>${escapeHtml(group.label)}</h4>
                  <div class="list-stack">
                    ${group.exercises.map((exercise) => `
                      <form class="result-form" data-workout-id="${workout.id}" data-exercise-id="${exercise.id}" data-exercise-name="${escapeHtml(exercise.name)}">
                        <div>
                          <strong>${escapeHtml(exercise.name)}</strong>
                          ${exerciseSummary(exercise) ? `<p class="muted">${exerciseSummary(exercise)}</p>` : ""}
                          ${exercise.notes ? `<p>${escapeHtml(exercise.notes)}</p>` : ""}
                        </div>
                        <div class="mini-grid">
                          <div class="field"><label>Time / score</label><input name="score" type="text" placeholder="18:42 or 7+12" /></div>
                          <div class="field"><label>Weight</label><input name="weight" type="number" min="0" step="0.5" placeholder="lb" /></div>
                          <div class="field"><label>Reps done</label><input name="reps" type="text" placeholder="6,6,5,5" /></div>
                          <label class="check-field"><input name="isPr" type="checkbox" /> PR</label>
                        </div>
                        <div class="field"><label>Notes</label><input name="notes" type="text" placeholder="How it felt" /></div>
                        <button type="submit" class="primary">Log result</button>
                      </form>
                    `).join("")}
                  </div>
                </section>
              `).join("")}
            </div>
          </article>
        `;
      }

      history.innerHTML = results.length ? results.map((result) => `
        <article class="item-card">
          <strong>${escapeHtml(result.exerciseName)}</strong>
          <p class="muted">${escapeHtml(result.completedOn)}${result.score ? ` · Score: ${escapeHtml(result.score)}` : ""} · ${escapeHtml(result.weight || "-")} lb · ${escapeHtml(result.reps || "-")} reps${result.isPr ? " · PR" : ""}</p>
          ${result.notes ? `<p>${escapeHtml(result.notes)}</p>` : ""}
        </article>
      `).join("") : `<p class="muted empty-state">No results logged yet.</p>`;

      view.querySelectorAll(".result-form").forEach((form) => {
        form.addEventListener("submit", async (event) => {
          event.preventDefault();
          const data = new FormData(form);
          try {
            await MangoFitnessStore.saveResult({
              id: uid("result"),
              workoutId: form.dataset.workoutId,
              exerciseId: form.dataset.exerciseId,
              exerciseName: form.dataset.exerciseName,
              completedOn: date.value || todayISO(),
              score: data.get("score"),
              weight: data.get("weight"),
              reps: data.get("reps"),
              notes: data.get("notes"),
              isPr: data.get("isPr") === "on"
            });
            form.reset();
            await renderAthlete();
          } catch (error) {
            view.insertAdjacentHTML("afterbegin", `<p class="error-text">${escapeHtml(friendlyError(error))}</p>`);
          }
        });
      });
    } catch (error) {
      view.innerHTML = `<p class="muted empty-state">${escapeHtml(friendlyError(error))}</p>`;
      history.innerHTML = `<p class="muted empty-state">Progress history unavailable until Supabase is ready.</p>`;
    }
  }

  date.addEventListener("change", renderAthlete);
  renderAthlete();
}
