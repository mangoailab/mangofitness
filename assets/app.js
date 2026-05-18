const MangoFitnessStore = (() => {
  const localWorkoutKey = "mangoFitness.workouts.v1";
  const localResultKey = "mangoFitness.results.v1";
  const localWarmupTemplateKey = "mangoFitness.warmupTemplates.v1";
  const localStrengthMovementKey = "mangoFitness.strengthMovements.v1";
  const localCardioBenchmarkKey = "mangoFitness.cardioBenchmarks.v1";
  const localAthleteKey = "mangoFitness.athletes.v1";

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
      assignmentType: row.assignment_type || row.assignmentType || "everyone",
      assignedAthleteIds: (row.workout_assignments || row.assignedAthleteIds || []).map((assignment) => assignment.athlete_id || assignment.athleteId || assignment).filter(Boolean),
      assignedAthleteNames: (row.workout_assignments || []).map((assignment) => assignment.athletes?.name).filter(Boolean),
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
      athleteId: row.athlete_id || "",
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
      setNumber: row.set_number || null,
      isPr: Boolean(row.is_pr)
    };
  }

  function normalizeBodyScan(row) {
    return {
      id: row.id,
      athleteId: row.athlete_id || "",
      source: row.scan_source || "",
      scannedOn: row.scanned_on,
      bodyWeight: row.body_weight ?? "",
      bodyFatPercent: row.body_fat_percent ?? "",
      fatMass: row.fat_mass ?? "",
      leanMass: row.lean_mass ?? "",
      skeletalMuscleMass: row.skeletal_muscle_mass ?? "",
      bmi: row.bmi ?? "",
      boneMineralContent: row.bone_mineral_content ?? "",
      rmr: row.resting_metabolic_rate ?? "",
      vat: row.visceral_adipose_tissue ?? "",
      visceralFatLevel: row.visceral_fat_level ?? "",
      androidFatPercent: row.android_fat_percent ?? "",
      gynoidFatPercent: row.gynoid_fat_percent ?? "",
      agRatio: row.ag_ratio ?? "",
      notes: row.notes || ""
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
    client,
    async currentUser() {
      return requireUser();
    },

    async athletes() {
      const sb = client();
      if (!sb) return readLocal(localAthleteKey);

      const { data, error } = await sb
        .from("athletes")
        .select("id, auth_user_id, name, email, phone, notes")
        .order("name", { ascending: true });
      if (error) throw error;
      return data || [];
    },

    async saveAthlete(athlete) {
      const sb = client();
      const payload = {
        name: athlete.name,
        email: athlete.email || null,
        phone: athlete.phone || null,
        notes: athlete.notes || null,
        auth_user_id: isUuid(athlete.authUserId) ? athlete.authUserId : null
      };
      if (!sb) {
        const athletes = readLocal(localAthleteKey).filter((item) => item.id !== athlete.id);
        const saved = { ...payload, id: athlete.id || uid("athlete"), auth_user_id: payload.auth_user_id };
        athletes.push(saved);
        writeLocal(localAthleteKey, athletes.sort((a, b) => a.name.localeCompare(b.name)));
        return saved;
      }

      if (athlete.id) {
        const { data, error } = await sb
          .from("athletes")
          .update(payload)
          .eq("id", athlete.id)
          .select("id, auth_user_id, name, email, phone, notes")
          .single();
        if (error) throw error;
        return data;
      }

      const { data, error } = await sb
        .from("athletes")
        .insert(payload)
        .select("id, auth_user_id, name, email, phone, notes")
        .single();
      if (error) throw error;
      return data;
    },

    async deleteAthlete(id) {
      const sb = client();
      if (!sb) {
        writeLocal(localAthleteKey, readLocal(localAthleteKey).filter((item) => item.id !== id));
        return;
      }
      const { error } = await sb.from("athletes").delete().eq("id", id);
      if (error) throw error;
    },

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
        .select("id, workout_date, title, notes, workout_format, rounds, score_type, warmup_notes, cardio_notes, assignment_type, workout_assignments (athlete_id, athletes (name, email)), workout_exercises (id, exercise_name, sets, reps, target, target_weight, benchmark_key, benchmark_name, movement_key, movement_name, section_type, notes, sort_order)")
        .order("workout_date", { ascending: true });

      if (error) throw error;
      return (data || []).map(normalizeWorkout);
    },

    async results() {
      const sb = client();
      if (!sb) return readLocal(localResultKey);

      const { data, error } = await sb
        .from("athlete_workout_results")
        .select("id, athlete_id, workout_exercise_id, completed_on, working_weight, reps_completed, notes, score_result, set_number, is_pr, workout_exercises (exercise_name, workout_id, benchmark_key, benchmark_name, movement_key, movement_name)")
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
        assignment_type: workout.assignmentType || "everyone",
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

      const { error: assignmentDeleteError } = await sb.from("workout_assignments").delete().eq("workout_id", workoutId);
      if (assignmentDeleteError) throw assignmentDeleteError;
      if (workout.assignmentType === "individual" && workout.assignedAthleteId) {
        const { error: assignmentError } = await sb.from("workout_assignments").insert({ workout_id: workoutId, athlete_id: workout.assignedAthleteId });
        if (assignmentError) throw assignmentError;
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

    async bodyScans(athleteId = "") {
      const sb = client();
      if (!sb) return [];
      const user = await requireUser();
      let query = sb
        .from("athlete_body_scans")
        .select("id, athlete_id, scan_source, scanned_on, body_weight, body_fat_percent, fat_mass, lean_mass, skeletal_muscle_mass, bmi, bone_mineral_content, resting_metabolic_rate, visceral_adipose_tissue, visceral_fat_level, android_fat_percent, gynoid_fat_percent, ag_ratio, notes")
        .order("scanned_on", { ascending: false })
        .order("created_at", { ascending: false });
      query = athleteId ? query.eq("athlete_id", athleteId) : query.eq("auth_user_id", user?.id || "");
      const { data, error } = await query;
      if (error) throw error;
      return (data || []).map(normalizeBodyScan);
    },

    async saveBodyScan(scan) {
      const sb = client();
      if (!sb) return;
      const user = await requireUser();
      const { data, error } = await sb.from("athlete_body_scans").insert({
        athlete_id: scan.athleteId || null,
        auth_user_id: user?.id || null,
        scan_source: scan.source || "PDF upload",
        scanned_on: scan.scannedOn,
        body_weight: scan.bodyWeight || null,
        body_fat_percent: scan.bodyFatPercent || null,
        fat_mass: scan.fatMass || null,
        lean_mass: scan.leanMass || null,
        skeletal_muscle_mass: scan.skeletalMuscleMass || null,
        bmi: scan.bmi || null,
        bone_mineral_content: scan.boneMineralContent || null,
        resting_metabolic_rate: scan.rmr || null,
        visceral_adipose_tissue: scan.vat || null,
        visceral_fat_level: scan.visceralFatLevel || null,
        android_fat_percent: scan.androidFatPercent || null,
        gynoid_fat_percent: scan.gynoidFatPercent || null,
        ag_ratio: scan.agRatio || null,
        notes: scan.notes || null
      }).select("id, athlete_id, scan_source, scanned_on, body_weight, body_fat_percent, fat_mass, lean_mass, skeletal_muscle_mass, bmi, bone_mineral_content, resting_metabolic_rate, visceral_adipose_tissue, visceral_fat_level, android_fat_percent, gynoid_fat_percent, ag_ratio, notes").single();
      if (error) throw error;
      return normalizeBodyScan(data);
    },

    async deleteBodyScan(id) {
      const sb = client();
      if (!sb) return;
      const user = await requireUser();
      const { error } = await sb
        .from("athlete_body_scans")
        .delete()
        .eq("id", id)
        .eq("auth_user_id", user?.id || "");
      if (error) throw error;
    },

    async updateBodyScan(id, scan) {
      const sb = client();
      if (!sb) return null;
      const user = await requireUser();
      const { data, error } = await sb
        .from("athlete_body_scans")
        .update({
          scanned_on: scan.scannedOn,
          body_weight: scan.bodyWeight || null,
          body_fat_percent: scan.bodyFatPercent || null,
          fat_mass: scan.fatMass || null,
          lean_mass: scan.leanMass || null,
          skeletal_muscle_mass: scan.skeletalMuscleMass || null,
          bmi: scan.bmi || null,
          bone_mineral_content: scan.boneMineralContent || null,
          resting_metabolic_rate: scan.rmr || null,
          visceral_adipose_tissue: scan.vat || null,
          visceral_fat_level: scan.visceralFatLevel || null,
          android_fat_percent: scan.androidFatPercent || null,
          gynoid_fat_percent: scan.gynoidFatPercent || null,
          ag_ratio: scan.agRatio || null,
          notes: scan.notes || null
        })
        .eq("id", id)
        .eq("auth_user_id", user?.id || "")
        .select("id, athlete_id, scan_source, scanned_on, body_weight, body_fat_percent, fat_mass, lean_mass, skeletal_muscle_mass, bmi, bone_mineral_content, resting_metabolic_rate, visceral_adipose_tissue, visceral_fat_level, android_fat_percent, gynoid_fat_percent, ag_ratio, notes")
        .single();
      if (error) throw error;
      return normalizeBodyScan(data);
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
        athlete_id: result.athleteId || null,
        auth_user_id: user?.id || null,
        workout_exercise_id: result.exerciseId,
        completed_on: result.completedOn,
        working_weight: result.weight || null,
        reps_completed: result.reps || null,
        notes: result.notes || null,
        score_result: result.score || null,
        set_number: result.setNumber || null,
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
let athleteProfiles = [];

function athleteOptions(selectedId = "") {
  return athleteProfiles.map((athlete) => `<option value="${escapeHtml(athlete.id)}"${athlete.id === selectedId ? " selected" : ""}>${escapeHtml(athlete.name)}${athlete.email ? ` · ${escapeHtml(athlete.email)}` : ""}</option>`).join("");
}

function workoutAssignmentLabel(workout) {
  if ((workout.assignmentType || "everyone") === "individual") {
    return `Individual${workout.assignedAthleteNames?.length ? ` · ${workout.assignedAthleteNames.map(escapeHtml).join(", ")}` : ""}`;
  }
  return "Everyone";
}

function isWorkoutVisibleToAthlete(workout, athleteId = "") {
  if ((workout.assignmentType || "everyone") === "everyone") return true;
  return Boolean(athleteId && (workout.assignedAthleteIds || []).includes(athleteId));
}

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
  date.setDate(date.getDate() - date.getDay());
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

function weekdayLabel(dateValue) {
  return new Intl.DateTimeFormat("en-US", { weekday: "short" }).format(dateValue);
}

function calendarDayLabel(dateValue) {
  return `${weekdayLabel(dateValue)} ${shortDate(dateValue)}`;
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

function initCoachClientsApp() {
  const form = document.getElementById("clientProfileForm");
  if (!form) return;

  const clientId = document.getElementById("clientId");
  const clientName = document.getElementById("clientName");
  const clientEmail = document.getElementById("clientEmail");
  const clientPhone = document.getElementById("clientPhone");
  const clientNotes = document.getElementById("clientNotes");
  const saveBtn = document.getElementById("saveClientBtn");
  const clearBtn = document.getElementById("clearClientBtn");
  const addClientBtn = document.getElementById("addClientBtn");
  const message = document.getElementById("clientProfileMessage");
  const list = document.getElementById("clientProfileList");
  const count = document.getElementById("clientProfileCount");
  const search = document.getElementById("clientSearch");

  function setClientMessage(text, isError = false) {
    if (!message) return;
    message.textContent = text || "";
    message.classList.toggle("hidden", !text);
    message.classList.toggle("error-text", Boolean(isError));
  }

  function showCreateForm(show = true) {
    form.classList.toggle("hidden", !show);
    addClientBtn?.classList.toggle("hidden", show);
    if (show) clientName?.focus();
  }

  function clearForm() {
    clientId.value = "";
    form.reset();
    saveBtn.textContent = "Create Client + Login";
    setClientMessage("");
    showCreateForm(false);
  }

  function clientSearchText(athlete) {
    return [athlete.name, athlete.email, athlete.phone, athlete.notes, athlete.auth_user_id || athlete.authUserId]
      .join(" ")
      .toLowerCase();
  }

  function renderClients() {
    if (!list) return;
    const term = (search?.value || "").trim().toLowerCase();
    const visibleClients = term ? athleteProfiles.filter((athlete) => clientSearchText(athlete).includes(term)) : athleteProfiles;
    count.textContent = term
      ? `${visibleClients.length} of ${athleteProfiles.length} client${athleteProfiles.length === 1 ? "" : "s"}`
      : `${athleteProfiles.length} client${athleteProfiles.length === 1 ? "" : "s"}`;
    if (!athleteProfiles.length) {
      list.innerHTML = `<p class="muted">No client profiles yet.</p>`;
      return;
    }
    if (!visibleClients.length) {
      list.innerHTML = `<p class="muted">No clients match that search.</p>`;
      return;
    }
    list.innerHTML = visibleClients.map((athlete) => {
      const authUserId = athlete.auth_user_id || athlete.authUserId || "";
      return `
        <details class="item-card client-profile-card" data-client-id="${escapeHtml(athlete.id)}">
          <summary class="client-profile-summary">
            <span>
              <strong>${escapeHtml(athlete.name)}</strong>
              <span class="muted">${escapeHtml(athlete.email || "No login email yet")}</span>
            </span>
            <span class="pill">${authUserId ? "Login linked" : "Not linked"}</span>
          </summary>
          <div class="client-profile-details">
            <p class="muted">${escapeHtml(athlete.email || "No login email yet")}${athlete.phone ? ` · ${escapeHtml(athlete.phone)}` : ""}</p>
            <p class="muted">Login link: ${authUserId ? "Auth user linked" : "Not linked — create/link Supabase Auth user"}</p>
            ${athlete.notes ? `<p>${escapeHtml(athlete.notes)}</p>` : ""}
            <div class="actions client-profile-actions">
              <button type="button" data-edit-client="${escapeHtml(athlete.id)}">Edit</button>
              <button type="button" data-create-athlete-login="${escapeHtml(athlete.id)}" ${authUserId ? "disabled" : ""}>Create Login</button>
              <button type="button" data-link-athlete-login="${escapeHtml(athlete.id)}" ${authUserId ? "disabled" : ""}>Find & Link Existing User</button>
              <button type="button" data-athlete-temp-password="${escapeHtml(athlete.id)}" ${authUserId ? "" : "disabled"}>Set Temporary Password</button>
              <button type="button" class="danger-button" data-delete-client="${escapeHtml(athlete.id)}">Delete</button>
            </div>
            <div id="clientEditor-${escapeHtml(athlete.id)}" class="hidden client-card-editor">
              <div class="grid-2 form-grid">
                <div class="field"><label>Name</label><input id="clientEditName-${escapeHtml(athlete.id)}" value="${escapeHtml(athlete.name || "")}" /></div>
                <div class="field"><label>Login email</label><input id="clientEditEmail-${escapeHtml(athlete.id)}" type="email" value="${escapeHtml(athlete.email || "")}" /></div>
              </div>
              <div class="grid-2 form-grid">
                <div class="field"><label>Phone</label><input id="clientEditPhone-${escapeHtml(athlete.id)}" type="tel" value="${escapeHtml(athlete.phone || "")}" /></div>
                <div class="field"><label>Supabase Auth user ID</label><input id="clientEditAuthUserId-${escapeHtml(athlete.id)}" value="${escapeHtml(authUserId)}" placeholder="Linked auth.users ID" /></div>
              </div>
              <div class="field"><label>Coach notes</label><textarea id="clientEditNotes-${escapeHtml(athlete.id)}" rows="3">${escapeHtml(athlete.notes || "")}</textarea></div>
              <div class="actions client-profile-actions">
                <button type="button" class="primary" data-save-client="${escapeHtml(athlete.id)}">Save</button>
                <button type="button" data-cancel-client-edit="${escapeHtml(athlete.id)}">Cancel</button>
              </div>
            </div>
            <p id="clientLoginResult-${escapeHtml(athlete.id)}" class="muted hidden"></p>
          </div>
        </details>
      `;
    }).join("");
  }

  function clientLoginResult(id) {
    return document.getElementById(`clientLoginResult-${id}`);
  }

  function clientEditField(id, field) {
    return document.getElementById(`clientEdit${field}-${id}`);
  }

  function toggleClientCardEdit(id, force) {
    const editor = document.getElementById(`clientEditor-${id}`);
    if (!editor) return;
    const shouldShow = typeof force === "boolean" ? force : editor.classList.contains("hidden");
    editor.classList.toggle("hidden", !shouldShow);
  }

  async function saveClientCard(id) {
    const name = clientEditField(id, "Name")?.value.trim() || "";
    const email = clientEditField(id, "Email")?.value.trim() || "";
    const authUserId = clientEditField(id, "AuthUserId")?.value.trim() || "";
    if (!name) return setClientLoginResult(id, "Enter the client name.", true);
    if (!email) return setClientLoginResult(id, "Enter the client login email.", true);
    if (authUserId && !isUuid(authUserId)) return setClientLoginResult(id, "Auth user ID must be a valid UUID, or leave it blank until the login exists.", true);

    try {
      await MangoFitnessStore.saveAthlete({
        id,
        name,
        email,
        phone: clientEditField(id, "Phone")?.value.trim() || "",
        authUserId,
        notes: clientEditField(id, "Notes")?.value.trim() || ""
      });
      await loadClients();
      setClientMessage("Client profile updated.");
    } catch (error) {
      setClientLoginResult(id, friendlyError(error), true);
    }
  }

  function setClientLoginResult(id, text, isError = false) {
    const result = clientLoginResult(id);
    if (!result) return;
    result.textContent = text || "";
    result.classList.toggle("hidden", !text);
    result.classList.toggle("error-text", Boolean(isError));
  }

  function athleteResetRedirectUrl() {
    return new URL("reset-password.html", window.location.href).href.replace(/[#?].*$/, "");
  }

  async function invokeAthleteLogin(athlete, action) {
    const id = athlete.id;
    const email = String(athlete.email || "").trim().toLowerCase();
    if (!email) throw new Error("Add an athlete login email first.");
    const sb = MangoFitnessStore.client();
    if (!sb?.functions) throw new Error("Supabase connection required to manage athlete logins.");

    const { data, error } = await sb.functions.invoke("create-athlete-user", {
      body: {
        action,
        athleteId: id,
        email,
        redirectTo: athleteResetRedirectUrl()
      }
    });
    if (error || data?.error) throw new Error(data?.hint || data?.error || error?.message || "Could not manage athlete login.");
    return data;
  }

  function athleteLoginMessage(data) {
    const emailLine = data.email ? ` Login email: ${data.email}.` : "";
    const userLine = data.userId ? ` User ID: ${data.userId}.` : "";
    const passwordLine = data.tempPassword ? ` Temporary password: ${data.tempPassword}` : "";
    return `${data.message || "Athlete login updated."}${emailLine}${userLine}${passwordLine}`;
  }

  async function createOrLinkAthleteLogin(athlete) {
    try {
      return await invokeAthleteLogin(athlete, "create-user");
    } catch (error) {
      if (!/already|registered|exists/i.test(friendlyError(error))) throw error;
      return invokeAthleteLogin(athlete, "link-existing-user");
    }
  }

  async function manageAthleteLogin(id, action, button) {
    const athlete = athleteProfiles.find((item) => item.id === id);
    if (!athlete) return;

    const actionText = action === "create-user"
      ? "Creating athlete login..."
      : action === "link-existing-user"
        ? "Finding existing login..."
        : "Setting temporary password...";
    setClientLoginResult(id, actionText);
    if (button) button.disabled = true;
    try {
      const data = await invokeAthleteLogin(athlete, action);
      const messageText = athleteLoginMessage(data);
      await loadClients();
      setClientLoginResult(id, messageText);
    } catch (error) {
      setClientLoginResult(id, friendlyError(error), true);
      if (button) button.disabled = false;
    }
  }

  async function loadClients() {
    try {
      athleteProfiles = await MangoFitnessStore.athletes();
      renderClients();
    } catch (error) {
      athleteProfiles = [];
      renderClients();
      setClientMessage(friendlyError(error), true);
    }
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    setClientMessage("");
    const name = clientName.value.trim();
    const email = clientEmail.value.trim();
    if (!name) return setClientMessage("Enter the client name.", true);
    if (!email) return setClientMessage("Enter the client login email.", true);

    saveBtn.disabled = true;
    saveBtn.textContent = "Creating client and login...";
    try {
      const savedAthlete = await MangoFitnessStore.saveAthlete({
        id: "",
        name,
        email,
        phone: clientPhone.value.trim(),
        authUserId: "",
        notes: clientNotes.value.trim()
      });
      const loginData = await createOrLinkAthleteLogin(savedAthlete);
      form.reset();
      showCreateForm(false);
      await loadClients();
      setClientMessage(`Client profile created. ${athleteLoginMessage(loginData)}`);
    } catch (error) {
      setClientMessage(friendlyError(error), true);
    } finally {
      saveBtn.disabled = false;
      saveBtn.textContent = "Create Client + Login";
    }
  });

  addClientBtn?.addEventListener("click", () => showCreateForm(true));
  clearBtn?.addEventListener("click", clearForm);
  search?.addEventListener("input", renderClients);

  list?.addEventListener("click", async (event) => {
    const editId = event.target.closest("[data-edit-client]")?.dataset.editClient;
    const saveEditId = event.target.closest("[data-save-client]")?.dataset.saveClient;
    const cancelEditId = event.target.closest("[data-cancel-client-edit]")?.dataset.cancelClientEdit;
    const createLoginId = event.target.closest("[data-create-athlete-login]")?.dataset.createAthleteLogin;
    const linkLoginId = event.target.closest("[data-link-athlete-login]")?.dataset.linkAthleteLogin;
    const tempPasswordId = event.target.closest("[data-athlete-temp-password]")?.dataset.athleteTempPassword;
    const deleteId = event.target.closest("[data-delete-client]")?.dataset.deleteClient;
    if (editId) return toggleClientCardEdit(editId);
    if (saveEditId) return saveClientCard(saveEditId);
    if (cancelEditId) return toggleClientCardEdit(cancelEditId, false);
    if (createLoginId) return manageAthleteLogin(createLoginId, "create-user", event.target.closest("button"));
    if (linkLoginId) return manageAthleteLogin(linkLoginId, "link-existing-user", event.target.closest("button"));
    if (tempPasswordId) return manageAthleteLogin(tempPasswordId, "set-temporary-password", event.target.closest("button"));
    if (!deleteId) return;
    const athlete = athleteProfiles.find((item) => item.id === deleteId);
    if (!athlete) return;
    if (!confirm(`Delete ${athlete.name}'s client profile? This can also remove related assignments/results if the database cascades them.`)) return;
    try {
      await MangoFitnessStore.deleteAthlete(deleteId);
      if (clientId.value === deleteId) clearForm();
      await loadClients();
      setClientMessage("Client profile deleted.");
    } catch (error) {
      setClientMessage(friendlyError(error), true);
    }
  });

  loadClients();
}

function initCoachApp() {
  const form = document.getElementById("workoutForm");
  if (!form) return;

  const showWorkoutFormBtn = document.getElementById("showWorkoutFormBtn");
  const date = document.getElementById("workoutDate");
  const title = document.getElementById("workoutTitle");
  const notes = document.getElementById("workoutNotes");
  const assignmentType = document.getElementById("assignmentType");
  const assignmentAthlete = document.getElementById("assignmentAthlete");
  const assignmentAthleteField = document.getElementById("assignmentAthleteField");
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
  const count = document.getElementById("workoutCount");
  const weekLabel = document.getElementById("workoutWeekLabel");
  const workoutSearch = document.getElementById("workoutSearch");
  const savedWorkoutAthleteFilter = document.getElementById("savedWorkoutAthleteFilter");
  const prevWeekBtn = document.getElementById("prevWeekBtn");
  const thisWeekBtn = document.getElementById("thisWeekBtn");
  const nextWeekBtn = document.getElementById("nextWeekBtn");
  const savedWorkoutVerticalViewBtn = document.getElementById("savedWorkoutVerticalViewBtn");
  const savedWorkoutHorizontalViewBtn = document.getElementById("savedWorkoutHorizontalViewBtn");
  const message = document.getElementById("coachAppMessage");
  const formHome = document.createComment("workout-form-home");
  form.after(formHome);
  let selectedWeekStart = startOfWeek(new Date());
  let savedWorkoutView = "vertical";

  date.value = todayISO();

  function setAppMessage(text, isError = false) {
    message.textContent = text || "";
    message.classList.toggle("hidden", !text);
    message.classList.toggle("error-text", Boolean(isError));
  }

  function renderAthleteOptions(selectedId = "") {
    if (assignmentAthlete) assignmentAthlete.innerHTML = `<option value="">Select athlete</option>${athleteOptions(selectedId)}`;
    if (savedWorkoutAthleteFilter) savedWorkoutAthleteFilter.innerHTML = `<option value="">Everyone / class workouts</option>${athleteOptions(savedWorkoutAthleteFilter.value || selectedId)}`;
  }

  function updateAssignmentVisibility() {
    const isIndividual = assignmentType?.value === "individual";
    assignmentAthleteField?.classList.toggle("hidden", !isIndividual);
  }

  async function loadAthletes() {
    try {
      athleteProfiles = await MangoFitnessStore.athletes();
      renderAthleteOptions();
    } catch (error) {
      athleteProfiles = [];
      renderAthleteOptions();
      setAppMessage(friendlyError(error), true);
    }
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

  function resultRowsForExercise(workoutResults, exercise) {
    return workoutResults.filter((result) => result.exerciseId === exercise.id || result.exerciseName === exercise.name);
  }

  function renderCoachProgramLogRows(workoutResults, exercise) {
    const rows = resultRowsForExercise(workoutResults, exercise);
    if (!rows.length) return `<p class="muted progress-note">No log yet.</p>`;
    return `
      <div class="coach-program-log-list">
        ${rows.map((result) => `
          <p class="muted progress-note">${escapeHtml(result.completedOn || "-")}${result.score ? ` · Score: ${escapeHtml(result.score)}` : ""}${result.weight !== "" && result.weight != null ? ` · ${escapeHtml(result.weight)} lb` : ""}${result.reps ? ` · ${escapeHtml(result.reps)} reps` : ""}${result.setNumber ? ` · set ${escapeHtml(result.setNumber)}` : ""}${result.isPr ? " · PR" : ""}${result.notes ? ` · ${escapeHtml(result.notes)}` : ""}</p>
        `).join("")}
      </div>
    `;
  }

  function renderExerciseGroups(exercises, options = {}) {
    const groups = exercisesBySection(exercises);
    if (!groups.length) return "";
    const workoutResults = options.results || [];
    return groups.map((group) => `
      <div class="exercise-group">
        <h4>${escapeHtml(group.label)}</h4>
        <ul class="clean-list">${group.exercises.map((exercise) => `
          <li>
            <strong>${escapeHtml(exercise.name)}</strong>${exerciseSummary(exercise) ? ` — ${exerciseSummary(exercise)}` : ""}
            ${options.showLogs ? renderCoachProgramLogRows(workoutResults, exercise) : ""}
          </li>
        `).join("")}</ul>
      </div>
    `).join("");
  }

  function workoutAthleteOptions(workout, selectedId = "") {
    const assignedIds = workout.assignmentType === "individual" ? (workout.assignedAthleteIds || []) : athleteProfiles.map((athlete) => athlete.id);
    const assignedAthletes = athleteProfiles.filter((athlete) => assignedIds.includes(athlete.id));
    return `<option value="">View athlete logs</option>${assignedAthletes.map((athlete) => `<option value="${escapeHtml(athlete.id)}"${athlete.id === selectedId ? " selected" : ""}>${escapeHtml(athlete.name)}</option>`).join("")}`;
  }

  function renderWorkoutProgramCard(workout, results, compact = false) {
    const selectedAthleteId = document.getElementById(`coachProgramAthlete-${workout.id}`)?.value || "";
    const selectedAthlete = athleteProfiles.find((athlete) => athlete.id === selectedAthleteId);
    const workoutResults = selectedAthleteId
      ? results.filter((result) => result.athleteId === selectedAthleteId && result.workoutId === workout.id)
      : [];
    return `
      <article class="${compact ? "calendar-workout-card" : "item-card"}" data-program-card="${escapeHtml(workout.id)}">
        <${compact ? "strong" : "div class=\"item-head\""}>${compact ? escapeHtml(workout.title) : `
          <div><strong>${escapeHtml(workout.title)}</strong><p class="muted">${escapeHtml(workout.date)} · ${workout.exercises.length} items · ${workoutAssignmentLabel(workout)}</p></div>
          <div class="actions item-actions">
            <button type="button" data-edit="${workout.id}">Edit</button>
            <button type="button" data-copy="${workout.id}">Copy</button>
            <button type="button" data-delete="${workout.id}">Delete</button>
          </div>
        `}</${compact ? "strong" : "div"}>
        ${compact ? `<p class="muted">${workout.exercises.length} items · ${workoutAssignmentLabel(workout)}${workout.warmupNotes ? " · Warm-up" : ""}${workout.cardioNotes ? " · WOD" : ""}</p>` : `<div data-inline-workout-editor></div>`}
        <div class="field coach-program-athlete-field">
          <label for="coachProgramAthlete-${escapeHtml(workout.id)}">View athlete logs in this program</label>
          <select id="coachProgramAthlete-${escapeHtml(workout.id)}" data-program-athlete="${escapeHtml(workout.id)}">${workoutAthleteOptions(workout, selectedAthleteId)}</select>
        </div>
        ${selectedAthlete ? `<p class="muted">Showing ${escapeHtml(selectedAthlete.name)}'s logged reps, weights, and scores inside this program.</p>` : ""}
        ${!compact && workout.notes ? `<p>${escapeHtml(workout.notes)}</p>` : ""}
        ${workout.warmupNotes ? `<div class="exercise-group"><h4>Warm-up</h4><p>${escapeHtml(workout.warmupNotes)}</p></div>` : ""}
        ${workout.cardioNotes ? `<div class="exercise-group"><h4>Cardio / WOD</h4><p>${escapeHtml(workout.cardioNotes)}</p></div>` : ""}
        ${renderExerciseGroups(workout.exercises, { showLogs: Boolean(selectedAthleteId), results: workoutResults })}
        ${compact ? `<div class="actions calendar-card-actions"><button type="button" data-edit="${workout.id}">Edit</button><button type="button" data-copy="${workout.id}">Copy</button></div>` : ""}
      </article>
    `;
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

  function returnWorkoutFormHome() {
    form.classList.remove("inline-workout-editor");
    formHome.parentNode?.insertBefore(form, formHome);
  }

  function showWorkoutForm(show = true, options = {}) {
    if (options.inlineContainer) {
      options.inlineContainer.innerHTML = "";
      options.inlineContainer.appendChild(form);
      form.classList.add("inline-workout-editor");
    } else if (show) {
      returnWorkoutFormHome();
    }
    form.classList.toggle("hidden", !show);
    showWorkoutFormBtn?.classList.toggle("hidden", show && !options.inlineContainer);
    if (show) date?.focus();
  }

  function clearForm(options = {}) {
    form.dataset.editId = "";
    date.value = todayISO();
    title.value = "";
    notes.value = "";
    if (assignmentType) assignmentType.value = "everyone";
    if (assignmentAthlete) assignmentAthlete.value = "";
    updateAssignmentVisibility();
    if (warmupTemplate) warmupTemplate.value = "";
    if (warmupTemplateName) warmupTemplateName.value = "";
    warmupNotes.value = "";
    cardioNotes.value = "";
    sectionRows.forEach((rowContainer) => { rowContainer.innerHTML = ""; });
    addExerciseRow("lifting");
    addExerciseRow("cardio");
    setAppMessage("");
    if (options.close !== false) {
      returnWorkoutFormHome();
      showWorkoutForm(false);
    }
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

  async function editWorkout(id, options = {}) {
    const workout = (await MangoFitnessStore.workouts()).find((item) => item.id === id);
    if (!workout) return;
    form.dataset.editId = workout.id;
    date.value = workout.date;
    title.value = workout.title;
    notes.value = workout.notes || "";
    if (assignmentType) assignmentType.value = workout.assignmentType || "everyone";
    if (assignmentAthlete) assignmentAthlete.value = workout.assignedAthleteIds?.[0] || "";
    updateAssignmentVisibility();
    warmupNotes.value = workout.warmupNotes || "";
    cardioNotes.value = workout.cardioNotes || "";
    sectionRows.forEach((rowContainer) => { rowContainer.innerHTML = ""; });
    workout.exercises.forEach((exercise) => addExerciseRow(exercise.section || "cardio", exercise));
    showWorkoutForm(true, { inlineContainer: options.inlineContainer });
    if (!options.inlineContainer) window.scrollTo({ top: form.offsetTop - 20, behavior: "smooth" });
  }

  async function copyWorkout(id) {
    const workout = (await MangoFitnessStore.workouts()).find((item) => item.id === id);
    if (!workout) return;
    form.dataset.editId = "";
    date.value = todayISO();
    title.value = `${workout.title} copy`;
    notes.value = workout.notes || "";
    if (assignmentType) assignmentType.value = workout.assignmentType || "everyone";
    if (assignmentAthlete) assignmentAthlete.value = workout.assignedAthleteIds?.[0] || "";
    updateAssignmentVisibility();
    warmupNotes.value = workout.warmupNotes || "";
    cardioNotes.value = workout.cardioNotes || "";
    sectionRows.forEach((rowContainer) => { rowContainer.innerHTML = ""; });
    workout.exercises.forEach((exercise) => addExerciseRow(exercise.section || "cardio", { ...exercise, id: "" }));
    showWorkoutForm(true);
    setAppMessage("Workout copied into the builder. Pick a date and save it.");
    window.scrollTo({ top: form.offsetTop - 20, behavior: "smooth" });
  }

  async function renderCoach() {
    try {
      const workouts = await MangoFitnessStore.workouts();
      const results = await MangoFitnessStore.results();
      const searchQuery = workoutSearch?.value.trim().toLowerCase() || "";
      const selectedScheduleAthleteId = savedWorkoutAthleteFilter?.value || "";
      const selectedScheduleAthlete = athleteProfiles.find((athlete) => athlete.id === selectedScheduleAthleteId);
      const weekStart = selectedWeekStart;
      const weekEnd = addDays(weekStart, 6);
      const visibleWorkouts = workouts.filter((workout) => {
        const matchesAthlete = selectedScheduleAthleteId
          ? (workout.assignmentType || "everyone") === "individual" && (workout.assignedAthleteIds || []).includes(selectedScheduleAthleteId)
          : (workout.assignmentType || "everyone") === "everyone";
        const matchesSearch = !searchQuery || workoutSearchText(workout).includes(searchQuery);
        if (!matchesAthlete || !matchesSearch) return false;
        if (searchQuery) return true;
        const workoutDate = parseLocalDate(workout.date);
        return workoutDate >= weekStart && workoutDate <= weekEnd;
      });

      count.textContent = searchQuery
        ? `${visibleWorkouts.length} match${visibleWorkouts.length === 1 ? "" : "es"}`
        : `${visibleWorkouts.length} this week`;
      if (weekLabel) {
        weekLabel.textContent = searchQuery
          ? `Search results${selectedScheduleAthlete ? ` for ${selectedScheduleAthlete.name}` : ""}`
          : `${selectedScheduleAthlete ? `${selectedScheduleAthlete.name} · ` : ""}Week of ${shortDate(weekStart)} – ${shortDate(weekEnd)}`;
      }

      if (searchQuery) {
        list.className = "list-stack";
        list.innerHTML = visibleWorkouts.length ? visibleWorkouts.map((workout) => renderWorkoutProgramCard(workout, results)).join("") : `<p class="muted empty-state">No workouts matched your search.</p>`;
      } else {
        const workoutsByDate = visibleWorkouts.reduce((map, workout) => {
          if (!map.has(workout.date)) map.set(workout.date, []);
          map.get(workout.date).push(workout);
          return map;
        }, new Map());
        list.className = savedWorkoutView === "horizontal" ? "workout-calendar athlete-program-calendar coach-horizontal-program-calendar" : "workout-calendar";
        let selectedHorizontalDate = "";
        list.innerHTML = Array.from({ length: 7 }, (_, index) => {
          const day = addDays(weekStart, index);
          const dayIso = isoDate(day);
          const dayWorkouts = workoutsByDate.get(dayIso) || [];
          if (savedWorkoutView === "horizontal") {
            if (!selectedHorizontalDate && dayWorkouts.length) selectedHorizontalDate = dayIso;
            return `
              <section class="calendar-day athlete-program-day" data-coach-horizontal-day="${escapeHtml(dayIso)}">
                <button type="button" class="calendar-day-head athlete-program-day-head" data-coach-horizontal-toggle="${escapeHtml(dayIso)}" aria-expanded="false" aria-label="Show ${escapeHtml(calendarDayLabel(day))} programs">
                  <span class="athlete-program-weekday">${escapeHtml(weekdayLabel(day))}</span>
                  <strong class="athlete-program-date">${escapeHtml(String(day.getDate()))}</strong>
                  <span class="muted athlete-program-count">${dayWorkouts.length || ""}</span>
                  <span class="athlete-program-dot${dayWorkouts.length ? " has-program" : ""}" aria-hidden="true"></span>
                </button>
              </section>
            `;
          }
          return `
            <section class="calendar-day">
              <div class="calendar-day-head">
                <strong>${escapeHtml(calendarDayLabel(day))}</strong>
                <span class="muted">${dayWorkouts.length || ""}</span>
              </div>
              <div class="calendar-day-body">
                ${dayWorkouts.length ? dayWorkouts.map((workout) => renderWorkoutProgramCard(workout, results, true)).join("") : `<p class="muted calendar-empty">No workout</p>`}
              </div>
            </section>
          `;
        }).join("");
        if (savedWorkoutView === "horizontal") {
          const selectedWorkouts = workoutsByDate.get(selectedHorizontalDate) || [];
          list.insertAdjacentHTML("beforeend", `
            <section class="coach-horizontal-detail" data-coach-horizontal-detail>
              <div class="section-head compact"><div><h3>${selectedHorizontalDate ? escapeHtml(calendarDayLabel(parseLocalDate(selectedHorizontalDate))) : "Program details"}</h3><p class="muted">${selectedWorkouts.length ? `${selectedWorkouts.length} program${selectedWorkouts.length === 1 ? "" : "s"}` : "No program for this day"}</p></div></div>
              <div data-inline-workout-editor></div>
              <div class="list-stack">${selectedWorkouts.length ? selectedWorkouts.map((workout) => renderWorkoutProgramCard(workout, results)).join("") : `<p class="muted empty-state">Select a day with a dot to view its program.</p>`}</div>
            </section>
          `);
          list.querySelector(`[data-coach-horizontal-day="${CSS.escape(selectedHorizontalDate)}"]`)?.classList.add("is-selected");
          list.querySelector(`[data-coach-horizontal-toggle="${CSS.escape(selectedHorizontalDate)}"]`)?.setAttribute("aria-expanded", "true");
        }
      }

      list.querySelectorAll("[data-coach-horizontal-toggle]").forEach((button) => button.addEventListener("click", () => {
        const selectedDate = button.dataset.coachHorizontalToggle;
        const workouts = visibleWorkouts.filter((workout) => workout.date === selectedDate);
        list.querySelectorAll("[data-coach-horizontal-day]").forEach((item) => item.classList.remove("is-selected"));
        list.querySelectorAll("[data-coach-horizontal-toggle]").forEach((item) => item.setAttribute("aria-expanded", "false"));
        button.closest("[data-coach-horizontal-day]")?.classList.add("is-selected");
        button.setAttribute("aria-expanded", "true");
        const detail = list.querySelector("[data-coach-horizontal-detail]");
        if (detail) {
          detail.innerHTML = `
            <div class="section-head compact"><div><h3>${escapeHtml(calendarDayLabel(parseLocalDate(selectedDate)))}</h3><p class="muted">${workouts.length ? `${workouts.length} program${workouts.length === 1 ? "" : "s"}` : "No program for this day"}</p></div></div>
            <div data-inline-workout-editor></div>
            <div class="list-stack">${workouts.length ? workouts.map((workout) => renderWorkoutProgramCard(workout, results)).join("") : `<p class="muted empty-state">No program for this day.</p>`}</div>
          `;
          detail.querySelectorAll("[data-edit]").forEach((editButton) => editButton.addEventListener("click", () => {
            const inlineContainer = editButton.closest("[data-program-card]")?.querySelector("[data-inline-workout-editor]") || detail.querySelector("[data-inline-workout-editor]");
            editWorkout(editButton.dataset.edit, { inlineContainer }).catch((error) => setAppMessage(friendlyError(error), true));
          }));
          detail.scrollIntoView({ behavior: "smooth", block: "nearest" });
        }
      }));
      list.querySelectorAll("[data-edit]").forEach((button) => button.addEventListener("click", () => {
        const inlineContainer = button.closest("[data-program-card]")?.querySelector("[data-inline-workout-editor]") || button.closest("[data-coach-horizontal-detail]")?.querySelector("[data-inline-workout-editor]");
        editWorkout(button.dataset.edit, { inlineContainer }).catch((error) => setAppMessage(friendlyError(error), true));
      }));
      list.querySelectorAll("[data-copy]").forEach((button) => button.addEventListener("click", () => copyWorkout(button.dataset.copy).catch((error) => setAppMessage(friendlyError(error), true))));
      list.querySelectorAll("[data-program-athlete]").forEach((select) => select.addEventListener("change", renderCoach));
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
      list.className = "list-stack";
      list.innerHTML = `<p class="muted empty-state">${escapeHtml(friendlyError(error))}</p>`;
    }
  }

  assignmentType?.addEventListener("change", updateAssignmentVisibility);

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
  savedWorkoutAthleteFilter?.addEventListener("change", renderCoach);
  savedWorkoutVerticalViewBtn?.addEventListener("click", () => {
    savedWorkoutView = "vertical";
    savedWorkoutVerticalViewBtn.classList.add("active");
    savedWorkoutHorizontalViewBtn?.classList.remove("active");
    renderCoach();
  });
  savedWorkoutHorizontalViewBtn?.addEventListener("click", () => {
    savedWorkoutView = "horizontal";
    savedWorkoutHorizontalViewBtn.classList.add("active");
    savedWorkoutVerticalViewBtn?.classList.remove("active");
    if (workoutSearch) workoutSearch.value = "";
    renderCoach();
  });

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

  document.querySelectorAll("[data-toggle-section]").forEach((button) => {
    const section = button.closest(".workout-section");
    const label = section?.querySelector("h3")?.textContent?.trim() || "section";
    function syncToggle() {
      const collapsed = section?.classList.contains("is-collapsed");
      button.textContent = collapsed ? "▾" : "▴";
      button.setAttribute("aria-expanded", collapsed ? "false" : "true");
      button.setAttribute("aria-label", `${collapsed ? "Expand" : "Collapse"} ${label}`);
    }
    button.addEventListener("click", () => {
      if (!section) return;
      section.classList.toggle("is-collapsed");
      syncToggle();
    });
    syncToggle();
  });

  document.querySelectorAll("[data-add-section]").forEach((button) => {
    button.addEventListener("click", () => addExerciseRow(button.dataset.addSection));
  });
  showWorkoutFormBtn?.addEventListener("click", () => showWorkoutForm(true));
  document.getElementById("clearWorkoutBtn")?.addEventListener("click", () => clearForm());
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const exercises = collectExercises();
    if (!date.value) return setAppMessage("Add a workout date.");
    if (assignmentType?.value === "individual" && !assignmentAthlete?.value) return setAppMessage("Choose an athlete for this individual workout.", true);
    if (!exercises.length) return setAppMessage("Add at least one exercise.");

    try {
      const savedId = await MangoFitnessStore.saveWorkout({
        id: form.dataset.editId || "",
        date: date.value,
        title: title.value.trim() || "Workout",
        notes: notes.value.trim(),
        warmupNotes: warmupNotes.value.trim(),
        cardioNotes: cardioNotes.value.trim(),
        assignmentType: assignmentType?.value || "everyone",
        assignedAthleteId: assignmentType?.value === "individual" ? assignmentAthlete?.value || "" : "",
        format: assignmentType?.value === "individual" ? "Individual workout" : "Class workout",
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

  loadAthletes();
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

function prescribedSetCount(exercise) {
  const match = String(exercise.sets || "").match(/\d+/);
  const count = match ? Number(match[0]) : 1;
  return Math.max(1, Math.min(count || 1, 12));
}

function numberFromMatch(text, regex) {
  const match = String(text || "").match(regex);
  if (!match) return "";
  return Number(String(match[1]).replace(/,/g, ""));
}

function plausibleNumber(value, min, max) {
  const number = Number(String(value || "").replace(/,/g, ""));
  return Number.isFinite(number) && number >= min && number <= max ? number : "";
}

function numbersNearLabel(text, labelRegex, min, max, limit = 260) {
  const source = String(text || "");
  const match = source.match(labelRegex);
  if (!match) return [];
  const start = Math.max(0, match.index || 0);
  const slice = source.slice(start, start + limit);
  return [...slice.matchAll(/\d{1,3}(?:,\d{3})*(?:\.\d+)?/g)]
    .map((item) => plausibleNumber(item[0], min, max))
    .filter((value) => value !== "");
}

function firstNumberNearLabel(text, labelRegex, min, max, limit = 260) {
  return numbersNearLabel(text, labelRegex, min, max, limit)[0] || "";
}

function dateFromFilename(filename) {
  const match = String(filename || "").match(/(20\d{2})[._-](\d{1,2})[._-](\d{1,2})/);
  if (!match) return "";
  return `${match[1]}-${String(match[2]).padStart(2, "0")}-${String(match[3]).padStart(2, "0")}`;
}

function scanDateFromText(text, filename = "") {
  const match = String(text || "").match(/Measured Date\s+.*?(\d{1,2}\/\d{1,2}\/\d{4})/i)
    || String(text || "").match(/Test Date\s+.*?(\d{1,2}[\/.-]\d{1,2}[\/.-]\d{4})/i)
    || String(text || "").match(/(\d{1,2}\/\d{1,2}\/\d{4})/);
  if (!match) return dateFromFilename(filename) || todayISO();
  const parts = match[1].split(/[\/.-]/).map(Number);
  const [month, day, year] = parts[0] > 1900 ? [parts[1], parts[2], parts[0]] : parts;
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function parseInBodyCoreMetrics(compact) {
  const values = {
    bodyWeight: firstNumberNearLabel(compact, /\bWeight\b|Wt\.?\s*\(?lb/i, 70, 400, 220),
    skeletalMuscleMass: firstNumberNearLabel(compact, /Skeletal\s+Muscle\s+Mass|\bSMM\b/i, 35, 180, 220),
    bodyFatPercent: firstNumberNearLabel(compact, /Percent\s+Body\s+Fat|\bPBF\b/i, 3, 60, 220)
  };

  const bodyFatMass = firstNumberNearLabel(compact, /Body\s+Fat\s+Mass|\bBFM\b/i, 3, 160, 220);
  if (bodyFatMass) values.fatMass = bodyFatMass;

  const bmi = firstNumberNearLabel(compact, /\bBMI\b/i, 10, 45, 180);
  if (bmi) values.bmi = bmi;

  const rmr = firstNumberNearLabel(compact, /Basal\s+Metabolic\s+Rate|\bBMR\b|\bRMR\b/i, 900, 3500, 220);
  if (rmr) values.rmr = rmr;

  const visceral = firstNumberNearLabel(compact, /Visceral\s+Fat\s+Level/i, 1, 30, 180);
  if (visceral) values.visceralFatLevel = visceral;

  // Safety checks. InBody OCR may jump into segmental tables, which creates
  // plausible-looking but wrong values. Do not keep values that contradict each other.
  if (values.bodyWeight && values.skeletalMuscleMass && values.skeletalMuscleMass > values.bodyWeight * 0.65) {
    values.skeletalMuscleMass = "";
  }
  if (values.bodyWeight && values.bodyFatPercent && values.fatMass) {
    const expectedFatMass = values.bodyWeight * values.bodyFatPercent / 100;
    if (Math.abs(values.fatMass - expectedFatMass) > Math.max(8, values.bodyWeight * 0.08)) {
      values.fatMass = "";
    }
  }
  if (values.bodyWeight && values.bodyFatPercent && !values.fatMass) {
    values.fatMass = Number((values.bodyWeight * values.bodyFatPercent / 100).toFixed(1));
  }

  return values;
}

function parseBodyScanText(text, filename = "") {
  const compact = String(text || "").replace(/\s+/g, " ");
  const summary = compact.match(/SUMMARY RESULTS.*?(\d{1,2}\/\d{1,2}\/\d{4})\s+([0-9.]+)%\s+([0-9.]+)\s+([0-9.]+)\s+([0-9.]+)\s+([0-9.]+)/i);
  const regionalTotal = compact.match(/Total\s+([0-9.]+)%\s+([0-9.]+)\s+([0-9.]+)\s+([0-9.]+)\s+([0-9.]+)/i);
  const inbody = /inbody|skeletal muscle mass|visceral fat level|percent body fat|\bSMM\b|\bPBF\b/i.test(compact) || /inbody/i.test(filename);
  const inbodyMetrics = inbody ? parseInBodyCoreMetrics(compact) : {};
  return {
    source: /bodyspec/i.test(compact) ? "BodySpec DEXA PDF" : inbody ? "InBody PDF" : "PDF upload",
    scannedOn: summary ? scanDateFromText(summary[1], filename) : scanDateFromText(compact, filename),
    bodyFatPercent: summary ? Number(summary[2]) : regionalTotal ? Number(regionalTotal[1]) : inbodyMetrics.bodyFatPercent || numberFromMatch(compact, /Total Body Fat %[^0-9]*([0-9.]+)/i),
    bodyWeight: summary ? Number(summary[3]) : regionalTotal ? Number(regionalTotal[2]) : inbodyMetrics.bodyWeight || "",
    fatMass: summary ? Number(summary[4]) : regionalTotal ? Number(regionalTotal[3]) : inbodyMetrics.fatMass || "",
    leanMass: summary ? Number(summary[5]) : regionalTotal ? Number(regionalTotal[4]) : "",
    skeletalMuscleMass: inbodyMetrics.skeletalMuscleMass || "",
    bmi: inbodyMetrics.bmi || "",
    boneMineralContent: summary ? Number(summary[6]) : regionalTotal ? Number(regionalTotal[5]) : "",
    rmr: inbodyMetrics.rmr || numberFromMatch(compact, /([0-9,]+)\s*(?:cal\/day|kcal)/i),
    vat: numberFromMatch(compact, /Mass \(lbs\)\s+([0-9.]+)/i),
    visceralFatLevel: inbodyMetrics.visceralFatLevel || "",
    androidFatPercent: numberFromMatch(compact, /Android \(A\).*?([0-9.]+)%/i) || numberFromMatch(compact, /Android\s+([0-9.]+)%/i),
    gynoidFatPercent: numberFromMatch(compact, /Gynoid \(G\).*?([0-9.]+)%/i) || numberFromMatch(compact, /Gynoid\s+([0-9.]+)%/i),
    agRatio: numberFromMatch(compact, /A\/G Ratio[^0-9]*([0-9.]+)/i),
    notes: "Imported from uploaded PDF."
  };
}

function scanMetric(value, suffix = "") {
  return value === "" || value == null ? "-" : `${escapeHtml(value)}${suffix}`;
}

function scanInputValue(value) {
  return value === "" || value == null ? "" : escapeHtml(value);
}

function renderBodyScanEditForm(scan) {
  return `
    <article class="item-card body-scan-preview-card">
      <div class="item-head">
        <div><strong>Review scan before saving</strong><p class="muted">OCR can miss InBody fields. Correct anything that looks wrong, then save.</p></div>
        <button type="button" class="primary" id="saveBodyScanBtn">Save scan</button>
      </div>
      ${(!scan.scannedOn || !scan.bodyWeight || !scan.skeletalMuscleMass || !scan.bodyFatPercent) ? `<p class="scan-warning">Check required InBody fields: scan date, weight, SMM, and PBF.</p>` : ""}
      <div class="scan-edit-grid">
        <div class="field"><label for="scanScannedOn">Scan date</label><input id="scanScannedOn" data-scan-field="scannedOn" type="date" value="${scanInputValue(scan.scannedOn)}" /></div>
        <div class="field"><label for="scanBodyWeight">Weight lb</label><input id="scanBodyWeight" data-scan-field="bodyWeight" type="number" step="0.1" value="${scanInputValue(scan.bodyWeight)}" /></div>
        <div class="field"><label for="scanBodyFatPercent">Body fat %</label><input id="scanBodyFatPercent" data-scan-field="bodyFatPercent" type="number" step="0.1" value="${scanInputValue(scan.bodyFatPercent)}" /></div>
        <div class="field"><label for="scanFatMass">Fat mass lb</label><input id="scanFatMass" data-scan-field="fatMass" type="number" step="0.1" value="${scanInputValue(scan.fatMass)}" /></div>
        <div class="field"><label for="scanSkeletalMuscleMass">Skeletal muscle lb</label><input id="scanSkeletalMuscleMass" data-scan-field="skeletalMuscleMass" type="number" step="0.1" value="${scanInputValue(scan.skeletalMuscleMass)}" /></div>
        <div class="field"><label for="scanBmi">BMI</label><input id="scanBmi" data-scan-field="bmi" type="number" step="0.1" value="${scanInputValue(scan.bmi)}" /></div>
        <div class="field"><label for="scanRmr">BMR / RMR</label><input id="scanRmr" data-scan-field="rmr" type="number" step="1" value="${scanInputValue(scan.rmr)}" /></div>
        <div class="field"><label for="scanVisceralFatLevel">Visceral fat level</label><input id="scanVisceralFatLevel" data-scan-field="visceralFatLevel" type="number" step="0.1" value="${scanInputValue(scan.visceralFatLevel)}" /></div>
      </div>
    </article>
  `;
}

function applyScanEdits(scan, container) {
  const edited = { ...scan };
  container?.querySelectorAll("[data-scan-field]").forEach((input) => {
    edited[input.dataset.scanField] = input.value;
  });
  return edited;
}

function renderBodyScanInlineEdit(scan) {
  return `
    <div class="scan-inline-edit" data-scan-edit-form="${escapeHtml(scan.id || "")}">
      <div class="scan-edit-grid">
        <div class="field"><label>Scan date</label><input data-scan-field="scannedOn" type="date" value="${scanInputValue(scan.scannedOn)}" /></div>
        <div class="field"><label>Weight lb</label><input data-scan-field="bodyWeight" type="number" step="0.1" value="${scanInputValue(scan.bodyWeight)}" /></div>
        <div class="field"><label>Body fat %</label><input data-scan-field="bodyFatPercent" type="number" step="0.1" value="${scanInputValue(scan.bodyFatPercent)}" /></div>
        <div class="field"><label>Fat mass lb</label><input data-scan-field="fatMass" type="number" step="0.1" value="${scanInputValue(scan.fatMass)}" /></div>
        <div class="field"><label>Skeletal muscle lb</label><input data-scan-field="skeletalMuscleMass" type="number" step="0.1" value="${scanInputValue(scan.skeletalMuscleMass)}" /></div>
        <div class="field"><label>BMI</label><input data-scan-field="bmi" type="number" step="0.1" value="${scanInputValue(scan.bmi)}" /></div>
        <div class="field"><label>BMR / RMR</label><input data-scan-field="rmr" type="number" step="1" value="${scanInputValue(scan.rmr)}" /></div>
        <div class="field"><label>Visceral fat level</label><input data-scan-field="visceralFatLevel" type="number" step="0.1" value="${scanInputValue(scan.visceralFatLevel)}" /></div>
      </div>
      <div class="actions scan-edit-actions">
        <button type="button" class="primary" data-scan-save-edit="${escapeHtml(scan.id || "")}">Save changes</button>
        <button type="button" data-scan-cancel-edit="${escapeHtml(scan.id || "")}">Cancel</button>
      </div>
    </div>
  `;
}

function renderBodyScanPreview(scan) {
  return `
    <details class="item-card body-scan-preview-card scan-history-card">
      <summary class="scan-history-summary">
        <div class="scan-summary-main">
          <strong>${escapeHtml(scan.scannedOn || "Unknown date")}</strong>
          <p class="muted">${escapeHtml(scan.source || "PDF upload")}</p>
          <div class="scan-summary-metrics">
            <span class="scan-metric-weight">Weight: ${scanMetric(scan.bodyWeight, " lb")}</span>
            <span class="scan-metric-smm">SMM: ${scanMetric(scan.skeletalMuscleMass, " lb")}</span>
            <span class="scan-metric-pbf">PBF: ${scanMetric(scan.bodyFatPercent, "%")}</span>
          </div>
        </div>
        <span class="section-chevron scan-summary-chevron" aria-hidden="true">⌄</span>
      </summary>
      <div class="scan-edit-slot"></div>
      <div class="scan-expanded-actions">
        ${scan.id ? `<button type="button" class="scan-action-btn scan-edit-btn" data-scan-edit="${escapeHtml(scan.id)}">Edit</button><button type="button" class="scan-action-btn scan-delete-btn" data-scan-delete="${escapeHtml(scan.id)}">Delete</button>` : ""}
      </div>
      <div class="scan-metric-grid scan-history-details">
        <div><span>Weight</span><strong>${scanMetric(scan.bodyWeight, " lb")}</strong></div>
        <div><span>Body fat</span><strong>${scanMetric(scan.bodyFatPercent, "%")}</strong></div>
        <div><span>Fat mass</span><strong>${scanMetric(scan.fatMass, " lb")}</strong></div>
        <div><span>Lean mass</span><strong>${scanMetric(scan.leanMass, " lb")}</strong></div>
        <div><span>Skeletal muscle</span><strong>${scanMetric(scan.skeletalMuscleMass, " lb")}</strong></div>
        <div><span>BMI</span><strong>${scanMetric(scan.bmi)}</strong></div>
        <div><span>RMR</span><strong>${scanMetric(scan.rmr, " cal")}</strong></div>
        <div><span>VAT</span><strong>${scanMetric(scan.vat, " lb")}</strong></div>
        <div><span>Visceral level</span><strong>${scanMetric(scan.visceralFatLevel)}</strong></div>
      </div>
    </details>
  `;
}

async function pdfTextFromFile(file) {
  const pdfjs = window.pdfjsLib || await import("https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.min.mjs");
  if (pdfjs.GlobalWorkerOptions) pdfjs.GlobalWorkerOptions.workerSrc = "https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.worker.min.mjs";
  const buffer = await file.arrayBuffer();
  const pdf = await pdfjs.getDocument({ data: buffer }).promise;
  const pages = [];
  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();
    pages.push(content.items.map((item) => item.str || "").join(" "));
  }
  const text = pages.join("\n").trim();
  if (text.replace(/\s+/g, " ").length > 80 || !window.Tesseract) return text;

  const ocrPages = [];
  for (let pageNumber = 1; pageNumber <= Math.min(pdf.numPages, 2); pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const viewport = page.getViewport({ scale: 2 });
    const canvas = document.createElement("canvas");
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    await page.render({ canvasContext: canvas.getContext("2d"), viewport }).promise;
    const result = await window.Tesseract.recognize(canvas, "eng");
    ocrPages.push(result?.data?.text || "");
  }
  return ocrPages.join("\n");
}

async function pdfImagesFromFile(file) {
  const pdfjs = window.pdfjsLib || await import("https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.min.mjs");
  if (pdfjs.GlobalWorkerOptions) pdfjs.GlobalWorkerOptions.workerSrc = "https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.worker.min.mjs";
  const buffer = await file.arrayBuffer();
  const pdf = await pdfjs.getDocument({ data: buffer }).promise;
  const images = [];
  for (let pageNumber = 1; pageNumber <= Math.min(pdf.numPages, 2); pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const viewport = page.getViewport({ scale: 2.4 });
    const canvas = document.createElement("canvas");
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    await page.render({ canvasContext: canvas.getContext("2d"), viewport }).promise;
    images.push(canvas.toDataURL("image/jpeg", 0.88));
  }
  return images;
}

async function aiParseBodyScanFile(file) {
  const sb = MangoFitnessStore.client?.() || window.mangoSupabaseClient || null;
  if (!sb?.functions?.invoke) throw new Error("AI parser unavailable.");
  const images = await pdfImagesFromFile(file);
  const { data, error } = await sb.functions.invoke("parse-body-scan", {
    body: { filename: file.name, images }
  });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data?.scan || null;
}


function resultMovementToken(result) {
  return String(result?.movementKey || result?.movementName || result?.exerciseName || "").trim().toLowerCase();
}

function exerciseMovementToken(exercise) {
  return String(exercise?.movementKey || exercise?.movementName || exercise?.name || "").trim().toLowerCase();
}

function numericWeight(value) {
  const match = String(value ?? "").match(/\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : null;
}

function numericReps(value) {
  const match = String(value ?? "").match(/\d+/);
  return match ? Number(match[0]) : null;
}

function matchingStrengthResults(results, exercise) {
  const token = exerciseMovementToken(exercise);
  return (results || []).filter((result) => {
    if (!token || resultMovementToken(result) !== token) return false;
    return numericWeight(result.weight) != null;
  });
}

function latestStrengthResult(results, exercise) {
  return matchingStrengthResults(results, exercise)[0] || null;
}

function estimatedOneRepMax(results, exercise) {
  return matchingStrengthResults(results, exercise).reduce((best, result) => {
    const weight = numericWeight(result.weight);
    const reps = numericReps(result.reps) || 1;
    if (!weight) return best;
    const estimate = weight * (1 + Math.min(reps, 12) / 30);
    return estimate > best ? estimate : best;
  }, 0);
}

function prescribedPercent(value) {
  const match = String(value || "").match(/(\d+(?:\.\d+)?)\s*%/);
  return match ? Number(match[1]) : null;
}

function roundTrainingWeight(value) {
  return Math.max(0, Math.round(value / 5) * 5);
}

function weightSuggestionForExercise(exercise, athleteResults = []) {
  const prescribed = numericWeight(exercise.weight);
  const percent = prescribedPercent(exercise.weight || exercise.target);
  const oneRepMax = estimatedOneRepMax(athleteResults, exercise);
  const latest = latestStrengthResult(athleteResults, exercise);
  if (percent && oneRepMax) {
    const suggested = roundTrainingWeight(oneRepMax * percent / 100);
    return {
      value: suggested,
      label: `${percent}% suggestion: ${suggested} lb`,
      detail: `Based on estimated 1RM ${Math.round(oneRepMax)} lb from history.`
    };
  }
  if (prescribed) {
    return {
      value: prescribed,
      label: `Programmed: ${prescribed} lb`,
      detail: "Based on the coach's programmed weight."
    };
  }
  if (latest) {
    return {
      value: numericWeight(latest.weight),
      label: `Last used: ${numericWeight(latest.weight)} lb`,
      detail: `${latest.completedOn || "Previous log"}${latest.reps ? ` · ${latest.reps} reps` : ""}`
    };
  }
  return null;
}

function renderSetLogFields(exercise, athleteResults = []) {
  const isStrength = (exercise.section || "cardio") === "lifting";
  if (!isStrength) {
    const scoreLabel = exercise.target || benchmarkScoreType(benchmarkByKey(exercise.benchmarkKey || "")) || "Score";
    const placeholder = /round/i.test(scoreLabel) ? "7+12" : /time/i.test(scoreLabel) ? "18:42" : scoreLabel;
    return `
      <div class="field cardio-score-field">
        <label>${escapeHtml(scoreLabel)}</label>
        <input name="score" type="text" placeholder="${escapeHtml(placeholder)}" />
      </div>
    `;
  }
  const suggestion = weightSuggestionForExercise(exercise, athleteResults);
  return `
    ${suggestion ? `
      <div class="weight-suggestion">
        <div><strong>${escapeHtml(suggestion.label)}</strong><p class="muted">${escapeHtml(suggestion.detail)}</p></div>
        <button type="button" data-apply-weight="${escapeHtml(suggestion.value)}">Use weight</button>
      </div>
    ` : `<p class="muted weight-suggestion-text">Enter set 1 weight to auto-fill the remaining sets.</p>`}
    <div class="set-log-table">
      <div class="set-log-head"><span>Set</span><span>Reps</span><span>Weight</span></div>
      ${Array.from({ length: prescribedSetCount(exercise) }, (_, index) => `
        <div class="set-log-row">
          <strong>${index + 1}</strong>
          <input name="set_${index + 1}_reps" type="text" inputmode="numeric" placeholder="${escapeHtml(exercise.reps || "reps")}" />
          <input name="set_${index + 1}_weight" type="text" inputmode="decimal" placeholder="${suggestion ? escapeHtml(`${suggestion.value} lb`) : "lb"}" />
        </div>
      `).join("")}
    </div>
  `;
}

function initAthleteTabs() {
  const tabs = [...document.querySelectorAll("[data-athlete-tab]")];
  const panels = [...document.querySelectorAll("[data-athlete-panel]")];
  if (!tabs.length || !panels.length) return;
  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      const target = tab.dataset.athleteTab;
      tabs.forEach((item) => item.classList.toggle("active", item === tab));
      panels.forEach((panel) => panel.classList.toggle("active", panel.dataset.athletePanel === target));
    });
  });
}

function initAthleteApp() {
  const date = document.getElementById("athleteWorkoutDate");
  const view = document.getElementById("athleteWorkoutView");
  const scheduleView = document.getElementById("athleteScheduleView");
  const profileSelect = document.getElementById("athleteProfileSelect");
  const weekLabel = document.getElementById("athleteWeekLabel");
  const workoutCount = document.getElementById("athleteWorkoutCount");
  const prevWeekBtn = document.getElementById("athletePrevWeekBtn");
  const thisWeekBtn = document.getElementById("athleteThisWeekBtn");
  const nextWeekBtn = document.getElementById("athleteNextWeekBtn");
  if (!date || !view) return;

  date.value = todayISO();
  let selectedWeekStart = startOfWeek(new Date());
  let signedInAthleteId = "";

  async function loadAthleteProfiles() {
    try {
      const user = await MangoFitnessStore.currentUser();
      athleteProfiles = await MangoFitnessStore.athletes();
      const userEmail = String(user?.email || "").toLowerCase();
      const athlete = athleteProfiles.find((item) => item.auth_user_id === user?.id || String(item.email || "").toLowerCase() === userEmail);
      signedInAthleteId = athlete?.id || "";
      if (profileSelect) {
        profileSelect.closest(".field")?.classList.add("hidden");
        profileSelect.innerHTML = signedInAthleteId
          ? `<option value="${escapeHtml(signedInAthleteId)}">${escapeHtml(athlete.name)}</option>`
          : `<option value="">Everyone / class workouts</option>`;
      }
    } catch {
      athleteProfiles = [];
      signedInAthleteId = "";
      if (profileSelect) {
        profileSelect.closest(".field")?.classList.add("hidden");
        profileSelect.innerHTML = `<option value="">Everyone / class workouts</option>`;
      }
    }
  }

  async function renderAthlete() {
    try {
      const workouts = await MangoFitnessStore.workouts();
      const selectedAthleteId = signedInAthleteId;
      const weekStart = selectedWeekStart;
      const weekEnd = addDays(weekStart, 6);
      const visibleWorkouts = workouts.filter((item) => isWorkoutVisibleToAthlete(item, selectedAthleteId));
      const weekWorkouts = visibleWorkouts.filter((item) => {
        const workoutDate = parseLocalDate(item.date);
        return workoutDate >= weekStart && workoutDate <= weekEnd;
      });
      const workout = visibleWorkouts.find((item) => item.date === date.value);

      if (weekLabel) weekLabel.textContent = `Week of ${shortDate(weekStart)} – ${shortDate(weekEnd)}`;
      if (workoutCount) workoutCount.textContent = `${weekWorkouts.length} workout${weekWorkouts.length === 1 ? "" : "s"}`;
      if (scheduleView) {
        const workoutsByDate = weekWorkouts.reduce((map, item) => {
          if (!map.has(item.date)) map.set(item.date, []);
          map.get(item.date).push(item);
          return map;
        }, new Map());
        scheduleView.innerHTML = Array.from({ length: 7 }, (_, index) => {
          const day = addDays(weekStart, index);
          const dayIso = isoDate(day);
          const dayWorkouts = workoutsByDate.get(dayIso) || [];
          return `
            <section class="calendar-day athlete-program-day${dayIso === date.value ? " is-selected" : ""}" data-athlete-day="${escapeHtml(dayIso)}">
              <button type="button" class="calendar-day-head athlete-program-day-head" data-athlete-date="${escapeHtml(dayIso)}" aria-label="View ${escapeHtml(calendarDayLabel(day))}">
                <span class="athlete-program-weekday">${escapeHtml(weekdayLabel(day))}</span>
                <strong class="athlete-program-date">${escapeHtml(String(day.getDate()))}</strong>
                <span class="muted athlete-program-count">${dayWorkouts.length || ""}</span>
                <span class="athlete-program-dot${dayWorkouts.length ? " has-program" : ""}" aria-hidden="true"></span>
              </button>
              <div class="calendar-day-body">
                ${dayWorkouts.length ? dayWorkouts.map((item) => `
                  <button type="button" class="calendar-workout-card athlete-schedule-card" data-athlete-date="${escapeHtml(item.date)}">
                    <strong>${escapeHtml(item.title)}</strong>
                    <p class="muted">${item.exercises.length} items · ${workoutAssignmentLabel(item)}</p>
                  </button>
                `).join("") : `<p class="muted calendar-empty">No workout</p>`}
              </div>
            </section>
          `;
        }).join("");
        scheduleView.querySelectorAll("[data-athlete-date]").forEach((button) => {
          button.addEventListener("click", () => {
            date.value = button.dataset.athleteDate;
            renderAthlete();
          });
        });
      }

      let athleteResults = [];
      if (workout && selectedAthleteId) {
        athleteResults = (await MangoFitnessStore.results()).filter((result) => result.athleteId === selectedAthleteId);
      }

      if (!workout) {
        view.innerHTML = `<p class="muted empty-state">No program assigned for ${escapeHtml(date.value || "this date")}.</p>`;
      } else {
        view.innerHTML = `
          <article class="item-card workout-detail">
            <h3>${escapeHtml(workout.title)}</h3>
            <p class="muted">${escapeHtml(workout.date)} · ${workoutAssignmentLabel(workout)}</p>
            ${workout.notes ? `<p>${escapeHtml(workout.notes)}</p>` : ""}
            ${workout.warmupNotes ? `<section class="athlete-workout-section"><h4>Warm-up</h4><p>${escapeHtml(workout.warmupNotes)}</p></section>` : ""}
            ${workout.cardioNotes ? `<section class="athlete-workout-section"><h4>Cardio / WOD</h4><p>${escapeHtml(workout.cardioNotes)}</p></section>` : ""}
            <div class="list-stack">
              ${workoutSectionGroups(workout.exercises).map((group) => `
                <section class="athlete-workout-section">
                  <h4>${escapeHtml(group.label)}</h4>
                  <div class="list-stack">
                    ${group.exercises.map((exercise) => (exercise.section || "cardio") === "partner" ? `
                      <div class="result-form partner-instruction-card">
                        <div>
                          <strong>${escapeHtml(exercise.name)}</strong>
                          ${exerciseSummary(exercise) ? `<p class="muted">${exerciseSummary(exercise)}</p>` : ""}
                          ${exercise.notes ? `<p>${escapeHtml(exercise.notes)}</p>` : ""}
                        </div>
                      </div>
                    ` : `
                      <form class="result-form" data-workout-id="${workout.id}" data-exercise-id="${exercise.id}" data-exercise-name="${escapeHtml(exercise.name)}">
                        <div>
                          <strong>${escapeHtml(exercise.name)}</strong>
                          ${exerciseSummary(exercise) ? `<p class="muted">${exerciseSummary(exercise)}</p>` : ""}
                          ${exercise.notes ? `<p>${escapeHtml(exercise.notes)}</p>` : ""}
                        </div>
                        ${renderSetLogFields(exercise, athleteResults)}
                        <div class="field"><label>Notes</label><input name="notes" type="text" placeholder="How it felt" /></div>
                        <button type="submit" class="primary">Log result</button>
                      </form>
                    `).join("")}
                    ${group.section === "partner" && group.exercises[0] ? `
                      <form class="result-form partner-score-form" data-workout-id="${workout.id}" data-exercise-id="${group.exercises[0].id}" data-exercise-name="Partner WOD">
                        <div>
                          <strong>Team result</strong>
                          <p class="muted">Log one final team time or score for the Partner WOD.</p>
                        </div>
                        <div class="field cardio-score-field"><label>Team time / score</label><input name="score" type="text" placeholder="18:42 or 6+14" /></div>
                        <div class="field"><label>Notes</label><input name="notes" type="text" placeholder="Partner, scaling, or how it felt" /></div>
                        <button type="submit" class="primary">Log team result</button>
                      </form>
                    ` : ""}
                  </div>
                </section>
              `).join("")}
            </div>
          </article>
        `;
      }

      view.querySelectorAll(".result-form").forEach((form) => {
        const weightInputs = [...form.querySelectorAll('input[name$="_weight"]')];
        const setGhostWeight = (input, value) => {
          if (!input.dataset.basePlaceholder) input.dataset.basePlaceholder = input.getAttribute("placeholder") || "lb";
          input.dataset.ghostWeight = value || "";
          input.placeholder = value ? `${value} lb` : input.dataset.basePlaceholder;
          input.classList.toggle("has-ghost-weight", Boolean(value) && !input.value);
        };
        const confirmGhostWeight = (input) => {
          if (!input.value && input.dataset.ghostWeight) {
            input.value = input.dataset.ghostWeight;
          }
          setGhostWeight(input, "");
        };
        const fillWeightsDown = (sourceIndex) => {
          const source = weightInputs[sourceIndex];
          const sourceWeight = source?.value || source?.dataset.ghostWeight || "";
          weightInputs.slice(sourceIndex + 1).forEach((input) => {
            if (!input.value) setGhostWeight(input, sourceWeight);
          });
        };
        weightInputs.forEach((input, index) => {
          input.addEventListener("input", () => {
            setGhostWeight(input, "");
            fillWeightsDown(index);
          });
          input.addEventListener("focus", () => confirmGhostWeight(input));
        });
        form.addEventListener("click", (event) => {
          const button = event.target.closest("[data-apply-weight]");
          if (!button) return;
          weightInputs.forEach((input, index) => {
            if (index === 0) {
              input.value = button.dataset.applyWeight || "";
              setGhostWeight(input, "");
            } else if (!input.value) {
              setGhostWeight(input, button.dataset.applyWeight || "");
            }
          });
        });
        form.addEventListener("submit", async (event) => {
          event.preventDefault();
          const data = new FormData(form);
          try {
            const setRows = [...form.querySelectorAll(".set-log-row")];
            if (setRows.length) {
              let savedAnySet = false;
              for (const [index] of setRows.entries()) {
                const setNumber = index + 1;
                const reps = data.get(`set_${setNumber}_reps`);
                const weightInput = form.querySelector(`[name="set_${setNumber}_weight"]`);
                const weight = numericWeight(data.get(`set_${setNumber}_weight`) || weightInput?.dataset.ghostWeight);
                if (!reps && weight == null) continue;
                savedAnySet = true;
                await MangoFitnessStore.saveResult({
                  id: uid("result"),
                  workoutId: form.dataset.workoutId,
                  athleteId: signedInAthleteId,
                  exerciseId: form.dataset.exerciseId,
                  exerciseName: form.dataset.exerciseName,
                  completedOn: date.value || todayISO(),
                  setNumber,
                  weight,
                  reps,
                  notes: data.get("notes"),
                  isPr: false
                });
              }
              if (!savedAnySet) throw new Error("Enter reps or weight for at least one set.");
            } else {
              await MangoFitnessStore.saveResult({
                id: uid("result"),
                workoutId: form.dataset.workoutId,
                athleteId: signedInAthleteId,
                exerciseId: form.dataset.exerciseId,
                exerciseName: form.dataset.exerciseName,
                completedOn: date.value || todayISO(),
                score: data.get("score"),
                weight: data.get("weight"),
                reps: data.get("reps"),
                notes: data.get("notes"),
                isPr: data.get("isPr") === "on"
              });
            }
            form.reset();
            await renderAthlete();
          } catch (error) {
            view.insertAdjacentHTML("afterbegin", `<p class="error-text">${escapeHtml(friendlyError(error))}</p>`);
          }
        });
      });
    } catch (error) {
      view.innerHTML = `<p class="muted empty-state">${escapeHtml(friendlyError(error))}</p>`;

    }
  }

  date.addEventListener("change", () => {
    selectedWeekStart = startOfWeek(parseLocalDate(date.value));
    renderAthlete();
  });
  MangoFitnessStore.client()?.auth?.onAuthStateChange?.((_event, session) => {
    if (session?.user) loadAthleteProfiles().then(renderAthlete);
  });
  prevWeekBtn?.addEventListener("click", () => {
    selectedWeekStart = addDays(selectedWeekStart, -7);
    renderAthlete();
  });
  thisWeekBtn?.addEventListener("click", () => {
    selectedWeekStart = startOfWeek(new Date());
    date.value = todayISO();
    renderAthlete();
  });
  nextWeekBtn?.addEventListener("click", () => {
    selectedWeekStart = addDays(selectedWeekStart, 7);
    renderAthlete();
  });
  loadAthleteProfiles().then(renderAthlete);

}

async function loadAthleteOptionsForSelect(select, emptyLabel = "Select athlete") {
  if (!select) return;
  try {
    athleteProfiles = await MangoFitnessStore.athletes();
    select.innerHTML = `<option value="">${escapeHtml(emptyLabel)}</option>${athleteOptions(select.value)}`;
  } catch {
    athleteProfiles = [];
    select.innerHTML = `<option value="">${escapeHtml(emptyLabel)}</option>`;
  }
}

function initAthleteHistoryApp(options = {}) {
  const mode = options.mode || "athlete";
  const coachMode = mode === "coach";
  const profileSelect = document.getElementById("historyProfileSelect");
  const profileField = profileSelect?.closest(".field");
  const history = document.getElementById("athleteHistoryList");
  const resultsList = document.getElementById("coachResultsList");
  const search = document.getElementById("progressSearch");
  const typeFilter = document.getElementById("progressTypeFilter");
  if (!history) return;

  async function currentAthleteId() {
    const user = await MangoFitnessStore.currentUser();
    const athletes = await MangoFitnessStore.athletes();
    athleteProfiles = athletes;
    const userEmail = String(user?.email || "").toLowerCase();
    const athlete = athletes.find((item) => item.auth_user_id === user?.id || String(item.email || "").toLowerCase() === userEmail);
    return athlete?.id || "";
  }

  function athleteName(athleteId) {
    return athleteProfiles.find((athlete) => athlete.id === athleteId)?.name || "Athlete";
  }

  function resultType(result) {
    if (result.score) return "score";
    if (result.weight !== "" && result.weight != null) return "strength";
    return "result";
  }

  function resultSearchText(result) {
    return [
      result.exerciseName,
      result.completedOn,
      result.score,
      result.weight,
      result.reps,
      result.notes,
      athleteName(result.athleteId),
      result.isPr ? "pr personal record" : ""
    ].join(" ").toLowerCase();
  }

  function progressDisplayValue(result) {
    return result.score || (result.weight !== "" && result.weight != null ? `${result.weight} lb` : (result.reps || "Logged"));
  }

  const progressGroupOrder = ["WODs", "Cardio", "Squats", "Barbell / Olympic Lifts", "Gymnastics", "Accessory / Strength", "Other"];

  function progressGroupLabel(result) {
    const text = [result.exerciseName, result.benchmarkName, result.movementName, result.notes].join(" ").toLowerCase();
    if (/\b(angie|cindy|murph|fran|helen|grace|death by|koko|wall ball|air ?squat|burpee|wod|amrap)\b/.test(text)) return "WODs";
    if (/\b(row|ski|assault bike|\bab\b|run|mile|double under|\bdu\b|vo2|heart rate)\b/.test(text)) return "Cardio";
    if (/\b(back squat|front squat|overhead squat|oh squat|sumo squat)\b/.test(text)) return "Squats";
    if (/\b(clean|snatch|jerk|thruster|deadlift|bench|press|push press|barbell|\bbb\b)\b/.test(text)) return "Barbell / Olympic Lifts";
    if (/\b(pull[- ]?up|chin[- ]?up|push[- ]?up|dip|hang|muscle[- ]?up|sit[- ]?up|v[- ]?up|box jump)\b/.test(text)) return "Gymnastics";
    if (/\b(row|curl|lunge|extension|farmer|t-bar|db|dumbbell|kettlebell|kb|forearm|bicep|abs|leg|shoulder)\b/.test(text)) return "Accessory / Strength";
    return "Other";
  }

  function sortProgressCategories(entries) {
    return [...entries].sort(([a], [b]) => {
      const ai = progressGroupOrder.indexOf(a);
      const bi = progressGroupOrder.indexOf(b);
      return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi) || a.localeCompare(b);
    });
  }

  function renderCoachResultsSummary(allResults) {
    if (!resultsList) return;
    const rows = [...allResults]
      .sort((a, b) => String(b.completedOn || "").localeCompare(String(a.completedOn || "")))
      .slice(0, 60);
    const categoryGroups = rows.reduce((map, result) => {
      const category = progressGroupLabel(result);
      const movement = result.exerciseName || "Movement";
      if (!map.has(category)) map.set(category, new Map());
      if (!map.get(category).has(movement)) map.get(category).set(movement, []);
      map.get(category).get(movement).push(result);
      return map;
    }, new Map());
    resultsList.innerHTML = rows.length ? `
      <div class="list-stack coach-results-groups">
        ${sortProgressCategories(categoryGroups.entries()).map(([category, movementGroups]) => `
          <section class="progress-category-block">
            <div class="progress-category-head"><strong>${escapeHtml(category)}</strong><span class="muted">${[...movementGroups.values()].reduce((total, group) => total + group.length, 0)} log${[...movementGroups.values()].reduce((total, group) => total + group.length, 0) === 1 ? "" : "s"}</span></div>
            ${[...movementGroups.entries()].map(([movement, group]) => `
              <section class="item-card coach-results-group">
                <div class="item-head"><div><strong>${escapeHtml(movement)}</strong><p class="muted">${group.length} recent log${group.length === 1 ? "" : "s"}</p></div></div>
                <div class="progress-table-wrap">
                  <table class="progress-table coach-results-table">
                    <thead><tr><th>Date</th><th>Athlete</th><th>Score</th><th>Weight</th><th>Reps</th><th>Set</th><th>PR</th><th>Notes</th></tr></thead>
                    <tbody>
                      ${group.map((result) => `
                        <tr class="${result.isPr ? "is-pr" : ""}">
                          <td>${escapeHtml(result.completedOn || "-")}</td>
                          <td>${escapeHtml(athleteName(result.athleteId))}</td>
                          <td>${escapeHtml(result.score || "-")}</td>
                          <td>${result.weight !== "" && result.weight != null ? `${escapeHtml(result.weight)} lb` : "-"}</td>
                          <td>${escapeHtml(result.reps || "-")}</td>
                          <td>${result.setNumber ? escapeHtml(result.setNumber) : "-"}</td>
                          <td>${result.isPr ? `<span class="pr-badge">PR</span>` : "-"}</td>
                          <td>${escapeHtml(result.notes || "")}</td>
                        </tr>
                      `).join("")}
                    </tbody>
                  </table>
                </div>
              </section>
            `).join("")}
          </section>
        `).join("")}
      </div>
    ` : `<p class="muted empty-state">No athlete results logged yet.</p>`;
  }

  function scoreToNumber(value) {
    const text = String(value || "").trim();
    if (!text) return null;
    const timeMatch = text.match(/^(\d+):(\d{2})(?::(\d{2}))?$/);
    if (timeMatch) {
      const first = Number(timeMatch[1]);
      const second = Number(timeMatch[2]);
      const third = timeMatch[3] == null ? null : Number(timeMatch[3]);
      return third == null ? first * 60 + second : first * 3600 + second * 60 + third;
    }
    const numeric = Number(text.replace(/[^0-9.-]/g, ""));
    return Number.isFinite(numeric) ? numeric : null;
  }

  function chartLabel(secondsOrNumber, preferTime = false) {
    if (!preferTime) return String(Number(secondsOrNumber.toFixed(1)).toString());
    const total = Math.round(secondsOrNumber);
    const minutes = Math.floor(total / 60);
    const seconds = String(total % 60).padStart(2, "0");
    return `${minutes}:${seconds}`;
  }

  function isStrengthGroup(group) {
    return group.some((result) => !result.score && result.weight !== "" && result.weight != null);
  }

  function renderProgressChart(group) {
    const strengthGroup = isStrengthGroup(group);
    const points = [...group]
      .sort((a, b) => String(a.completedOn || "").localeCompare(String(b.completedOn || "")))
      .map((result, index) => ({ result, index, value: scoreToNumber(strengthGroup ? result.weight : (result.score || result.weight)) }))
      .filter((point) => point.value != null);
    if (points.length < 2) return "";
    const preferTime = !strengthGroup && points.some((point) => String(point.result.score || "").includes(":"));
    const width = 640;
    const height = 220;
    const pad = 34;
    const values = points.map((point) => point.value);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const padding = Math.max(1, (max - min) * 0.15);
    const chartMin = min - padding;
    const chartMax = max + padding;
    const range = Math.max(0.1, chartMax - chartMin);
    const x = (index) => pad + (points.length === 1 ? 0 : index * ((width - pad * 2) / (points.length - 1)));
    const y = (value) => height - pad - ((value - chartMin) / range) * (height - pad * 2);
    const polyPoints = points.map((point, index) => `${x(index)},${y(point.value)}`);
    return `
      <div class="progress-chart-card">
        <div class="progress-chart-head"><strong>${strengthGroup ? "Weight trend" : "Score trend"}</strong><span class="muted">${escapeHtml(chartLabel(points[0].value, preferTime))}${strengthGroup ? " lb" : ""} → ${escapeHtml(chartLabel(points.at(-1).value, preferTime))}${strengthGroup ? " lb" : ""}</span></div>
        <div class="progress-chart-wrap">
          <svg viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeHtml(group[0]?.exerciseName || "Progress")} trend chart">
            <line x1="${pad}" y1="${pad}" x2="${pad}" y2="${height - pad}" stroke="#d9f5c9" stroke-width="2" />
            <line x1="${pad}" y1="${height - pad}" x2="${width - pad}" y2="${height - pad}" stroke="#d9f5c9" stroke-width="2" />
            <polyline points="${polyPoints.join(" ")}" fill="none" stroke="#0f7a3b" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" />
            ${points.map((point, index) => `<circle cx="${x(index)}" cy="${y(point.value)}" r="5" fill="#ffb703" />`).join("")}
          </svg>
        </div>
        <div class="progress-chart-dates">${points.map((point) => `<span>${escapeHtml(point.result.completedOn || "-")}</span>`).join("")}</div>
      </div>
    `;
  }

  function renderProgressTable(group) {
    const rows = [...group].sort((a, b) => String(b.completedOn || "").localeCompare(String(a.completedOn || "")));
    const strengthGroup = isStrengthGroup(group);
    if (strengthGroup) {
      return `
        <div class="progress-table-wrap">
          <table class="progress-table strength-progress-table">
            <thead><tr><th>Date</th><th>Weight</th><th>Reps</th><th>Set</th><th>Notes</th></tr></thead>
            <tbody>
              ${rows.map((result) => `
                <tr class="${result.isPr ? "is-pr" : ""}">
                  <td>${escapeHtml(result.completedOn || "-")}</td>
                  <td><strong>${result.weight !== "" && result.weight != null ? `${escapeHtml(result.weight)} lb` : "-"}</strong>${result.isPr ? ` <span class="pr-badge">PR</span>` : ""}</td>
                  <td>${escapeHtml(result.reps || "-")}</td>
                  <td>${result.setNumber ? escapeHtml(result.setNumber) : "-"}</td>
                  <td>${escapeHtml(result.notes || "")}</td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        </div>
      `;
    }
    return `
      <div class="progress-table-wrap">
        <table class="progress-table">
          <thead><tr><th>Date</th><th>Score</th><th>Notes</th></tr></thead>
          <tbody>
            ${rows.map((result) => `
              <tr class="${result.isPr ? "is-pr" : ""}">
                <td>${escapeHtml(result.completedOn || "-")}</td>
                <td><strong>${escapeHtml(progressDisplayValue(result))}</strong>${result.isPr ? ` <span class="pr-badge">PR</span>` : ""}</td>
                <td>${escapeHtml(result.notes || "")}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
    `;
  }

  async function renderHistory() {
    try {
      const allResults = await MangoFitnessStore.results();
      const selectedAthleteId = coachMode ? (profileSelect?.value || "") : await currentAthleteId();
      const term = (search?.value || "").trim().toLowerCase();
      const selectedType = typeFilter?.value || "all";
      const baseResults = coachMode
        ? (selectedAthleteId ? allResults.filter((result) => result.athleteId === selectedAthleteId) : allResults)
        : allResults.filter((result) => result.athleteId === selectedAthleteId);
      const results = baseResults.filter((result) => {
        const matchesSearch = !term || resultSearchText(result).includes(term);
        const matchesType = selectedType === "all" || (selectedType === "pr" ? result.isPr : resultType(result) === selectedType);
        return matchesSearch && matchesType;
      });
      if (coachMode) renderCoachResultsSummary(results);
      if (coachMode) return;
      if (!results.length) {
        history.innerHTML = `<p class="muted empty-state">${baseResults.length ? "No progress logs match those filters." : "No results logged for your athlete account yet."}</p>`;
        return;
      }
      const grouped = results.reduce((groups, result) => {
        const key = `${coachMode ? result.athleteId : "athlete"}::${result.exerciseName}`;
        groups[key] = groups[key] || [];
        groups[key].push(result);
        return groups;
      }, {});
      const groups = Object.values(grouped).sort((a, b) => String(b[0]?.completedOn || "").localeCompare(String(a[0]?.completedOn || "")));
      const categoryGroups = groups.reduce((map, group) => {
        const category = progressGroupLabel(group[0]);
        if (!map.has(category)) map.set(category, []);
        map.get(category).push(group);
        return map;
      }, new Map());
      let detailIndex = 0;
      history.innerHTML = `
        <div class="progress-overview-wrap">
          <table class="progress-overview-table">
            <thead><tr><th></th><th>Movement</th><th>Latest</th><th>Logs</th></tr></thead>
            <tbody>
              ${sortProgressCategories(categoryGroups.entries()).map(([category, categoryMovementGroups]) => `
                <tr class="progress-category-row"><td colspan="4">${escapeHtml(category)}</td></tr>
                ${categoryMovementGroups.map((group) => {
                  const index = detailIndex++;
                  const latest = group[0];
                  const prCount = group.filter((result) => result.isPr).length;
                  const latestValue = progressDisplayValue(latest);
                  const subtitle = [coachMode ? athleteName(latest.athleteId) : "", latest.completedOn || "-"].filter(Boolean).join(" · ");
                  return `
                    <tr class="progress-overview-row ${prCount ? "has-pr" : ""}">
                      <td><button type="button" class="progress-toggle" data-progress-toggle="${index}" aria-expanded="false" aria-label="Show ${escapeHtml(latest.exerciseName)} details">▸</button></td>
                      <td><strong>${escapeHtml(latest.exerciseName)}</strong><span class="muted">${escapeHtml(subtitle)}</span></td>
                      <td><strong>${escapeHtml(latestValue)}</strong>${prCount ? ` <span class="pr-badge">${prCount} PR${prCount === 1 ? "" : "s"}</span>` : ""}</td>
                      <td>${group.length}</td>
                    </tr>
                    <tr class="progress-detail-row hidden" data-progress-detail="${index}">
                      <td colspan="4"><div class="progress-log-list">${renderProgressChart(group)}${renderProgressTable(group)}</div></td>
                    </tr>
                  `;
                }).join("")}
              `).join("")}
            </tbody>
          </table>
        </div>
      `;
    } catch (error) {
      history.innerHTML = `<p class="muted empty-state">${escapeHtml(friendlyError(error))}</p>`;
      if (resultsList) resultsList.innerHTML = `<p class="muted empty-state">Results unavailable until Supabase is ready.</p>`;
    }
  }

  async function bootstrapHistory() {
    if (coachMode) {
      profileField?.classList.remove("hidden");
      await loadAthleteOptionsForSelect(profileSelect, "Select athlete");
    } else {
      profileField?.classList.add("hidden");
    }
    await renderHistory();
  }

  bootstrapHistory();
  profileSelect?.addEventListener("change", renderHistory);
  search?.addEventListener("input", renderHistory);
  typeFilter?.addEventListener("change", renderHistory);
  history.addEventListener("click", (event) => {
    const button = event.target.closest("[data-progress-toggle]");
    if (!button) return;
    const key = button.dataset.progressToggle;
    const row = history.querySelector(`[data-progress-detail="${key}"]`);
    const isOpen = row && !row.classList.contains("hidden");
    row?.classList.toggle("hidden", isOpen);
    button.textContent = isOpen ? "▸" : "▾";
    button.setAttribute("aria-expanded", String(!isOpen));
  });
  MangoFitnessStore.client()?.auth?.onAuthStateChange?.((_event, session) => {
    if (session?.user) bootstrapHistory();
  });
}

function initAthleteLeaderboardApp() {
  const list = document.getElementById("athleteLeaderboardList");
  const search = document.getElementById("leaderboardSearch");
  const typeFilter = document.getElementById("leaderboardTypeFilter");
  if (!list) return;

  function eventKey(result) {
    const name = String(result.exerciseName || result.event_name || "").toLowerCase();
    if (/\b(row 2k|2k row|2000m row|row 2000m)\b/.test(name)) return { type: "row", name: "2K Row", mode: "lower" };
    if (/\b(row 3k|3k row|3000m row|row 3000m)\b/.test(name)) return { type: "row", name: "3K Row", mode: "lower" };
    if (/\b(row 4k|4k row|4000m row|row 4000m)\b/.test(name)) return { type: "row", name: "4K Row", mode: "lower" };
    if (/\b(angie|cindy|murph|fran|helen|grace|annie|death by|koko|wall ball|burpee|air ?squat)\b/.test(name)) {
      const lowerIsBetter = /\b(angie|murph|fran|helen|grace|annie|koko|wall ball)\b/.test(name) || String(result.score || "").includes(":");
      return { type: "wod", name: result.exerciseName || result.event_name || "CrossFit WOD", mode: lowerIsBetter ? "lower" : "higher" };
    }
    return null;
  }

  function scoreSeconds(value) {
    const text = String(value || "").trim();
    const match = text.match(/^(\d+):(\d{2})(?::(\d{2}))?$/);
    if (!match) return null;
    const first = Number(match[1]);
    const second = Number(match[2]);
    const third = match[3] == null ? null : Number(match[3]);
    return third == null ? first * 60 + second : first * 3600 + second * 60 + third;
  }

  function scoreValue(result, mode) {
    const score = String(result.score || "").toLowerCase();
    const seconds = scoreSeconds(score);
    if (seconds != null) return seconds;
    const rounds = score.match(/(\d+(?:\.\d+)?)\s*round/);
    const reps = score.match(/\+\s*(\d+(?:\.\d+)?)/) || score.match(/(\d+(?:\.\d+)?)\s*rep/);
    if (rounds) return Number(rounds[1]) * 1000 + (reps ? Number(reps[1]) : 0);
    const numeric = Number(score.replace(/[^0-9.-]/g, ""));
    if (Number.isFinite(numeric)) return numeric;
    const resultReps = Number(String(result.reps || "").replace(/[^0-9.-]/g, ""));
    if (Number.isFinite(resultReps)) return resultReps;
    return mode === "lower" ? Number.POSITIVE_INFINITY : Number.NEGATIVE_INFINITY;
  }

  function isBetter(candidate, current, mode) {
    if (!current) return true;
    const candidateValue = scoreValue(candidate, mode);
    const currentValue = scoreValue(current, mode);
    if (candidateValue === currentValue) return String(candidate.completedOn || "").localeCompare(String(current.completedOn || "")) > 0;
    return mode === "lower" ? candidateValue < currentValue : candidateValue > currentValue;
  }

  function leaderboardAthleteName(result) {
    return result.athlete_name || "Athlete";
  }

  function leaderboardDisplayValue(result) {
    return result.score || result.score_result || (result.weight !== "" && result.weight != null ? `${result.weight} lb` : (result.working_weight !== "" && result.working_weight != null ? `${result.working_weight} lb` : (result.reps || result.reps_completed || "Logged")));
  }

  function renderLeaderboardEvent(eventName, entries, mode) {
    const ranked = [...entries].sort((a, b) => {
      const av = scoreValue(a, mode);
      const bv = scoreValue(b, mode);
      return mode === "lower" ? av - bv : bv - av;
    });
    return `
      <section class="item-card leaderboard-event-card">
        <div class="item-head"><div><strong>${escapeHtml(eventName)}</strong><p class="muted">${ranked.length} athlete${ranked.length === 1 ? "" : "s"}</p></div><span class="pill">${mode === "lower" ? "Lowest time wins" : "Highest score wins"}</span></div>
        <div class="progress-table-wrap">
          <table class="progress-table leaderboard-table">
            <thead><tr><th>Rank</th><th>Athlete</th><th>Best</th><th>Date</th><th>Notes</th></tr></thead>
            <tbody>
              ${ranked.map((result, index) => `
                <tr class="${index === 0 ? "leaderboard-winner" : ""}">
                  <td><strong>#${index + 1}</strong></td>
                  <td>${escapeHtml(leaderboardAthleteName(result))}</td>
                  <td><strong>${escapeHtml(leaderboardDisplayValue(result))}</strong></td>
                  <td>${escapeHtml(result.completedOn || "-")}</td>
                  <td>${escapeHtml(result.notes || "")}</td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        </div>
      </section>
    `;
  }

  async function renderLeaderboards() {
    try {
      const sb = MangoFitnessStore.client();
      if (!sb?.rpc) throw new Error("Leaderboard unavailable until Supabase is ready.");
      const { data, error } = await sb.rpc("leaderboard_results");
      if (error) throw error;
      const results = (data || []).map((row) => ({
        athleteId: row.athlete_id,
        athlete_name: row.athlete_name,
        exerciseName: row.event_name,
        completedOn: row.completed_on,
        score: row.score_result,
        weight: row.working_weight,
        reps: row.reps_completed,
        notes: row.notes || ""
      }));
      const term = (search?.value || "").trim().toLowerCase();
      const selectedType = typeFilter?.value || "all";
      const bestByEventAndAthlete = new Map();
      results.forEach((result) => {
        const event = eventKey(result);
        if (!event) return;
        if (selectedType !== "all" && event.type !== selectedType) return;
        const haystack = [event.name, result.exerciseName, leaderboardAthleteName(result), result.score, result.notes].join(" ").toLowerCase();
        if (term && !haystack.includes(term)) return;
        const key = `${event.name}::${result.athleteId}`;
        const current = bestByEventAndAthlete.get(key);
        if (isBetter(result, current?.result, event.mode)) bestByEventAndAthlete.set(key, { event, result });
      });
      const eventGroups = [...bestByEventAndAthlete.values()].reduce((map, item) => {
        if (!map.has(item.event.name)) map.set(item.event.name, { event: item.event, results: [] });
        map.get(item.event.name).results.push(item.result);
        return map;
      }, new Map());
      const eventOrder = ["Angie", "Cindy", "Murph", "Fran", "Helen", "Grace", "Annie", "2K Row", "3K Row", "4K Row"];
      const groups = [...eventGroups.values()].sort((a, b) => {
        const ai = eventOrder.indexOf(a.event.name);
        const bi = eventOrder.indexOf(b.event.name);
        return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi) || a.event.name.localeCompare(b.event.name);
      });
      list.innerHTML = groups.length ? `<div class="list-stack leaderboard-list">${groups.map((group) => renderLeaderboardEvent(group.event.name, group.results, group.event.mode)).join("")}</div>` : `<p class="muted empty-state">No leaderboard results found yet.</p>`;
    } catch (error) {
      list.innerHTML = `<p class="muted empty-state">${escapeHtml(friendlyError(error))}</p>`;
    }
  }

  renderLeaderboards();
  search?.addEventListener("input", renderLeaderboards);
  typeFilter?.addEventListener("change", renderLeaderboards);
  MangoFitnessStore.client()?.auth?.onAuthStateChange?.((_event, session) => {
    if (session?.user) renderLeaderboards();
  });
}

function metricNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function renderBodyScanChart(scans, selectedMetricKey = "bodyWeight") {
  const ordered = [...(scans || [])].filter((scan) => scan.scannedOn).sort((a, b) => a.scannedOn.localeCompare(b.scannedOn));
  if (ordered.length < 2) {
    return `<p class="muted empty-state">Upload at least 2 scans to see a progress chart.</p>`;
  }
  const metricMap = {
    bodyWeight: { key: "bodyWeight", label: "Weight", color: "#0f7a3b", suffix: " lb" },
    skeletalMuscleMass: { key: "skeletalMuscleMass", label: "SMM", color: "#ffb703", suffix: " lb" },
    bodyFatPercent: { key: "bodyFatPercent", label: "PBF", color: "#fb7185", suffix: "%" }
  };
  const metric = metricMap[selectedMetricKey] || metricMap.bodyWeight;
  const points = ordered
    .map((scan, index) => ({ scan, index, value: metricNumber(scan[metric.key]) }))
    .filter((point) => point.value != null);
  if (points.length < 2) {
    return `<p class="muted empty-state">Not enough ${escapeHtml(metric.label)} data to chart yet.</p>`;
  }
  const width = 680;
  const height = 260;
  const pad = 34;
  const values = points.map((point) => point.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const padding = Math.max(0.5, (max - min) * 0.15);
  const chartMin = min - padding;
  const chartMax = max + padding;
  const range = Math.max(0.1, chartMax - chartMin);
  const x = (orderIndex) => pad + (ordered.length === 1 ? 0 : orderIndex * ((width - pad * 2) / (ordered.length - 1)));
  const y = (value) => height - pad - ((value - chartMin) / range) * (height - pad * 2);
  const polyPoints = points.map((point) => `${x(point.index)},${y(point.value)}`);
  const first = points[0].value;
  const latest = points[points.length - 1].value;
  const delta = latest - first;
  const deltaText = `${delta >= 0 ? "+" : ""}${Number(delta.toFixed(1))}${metric.suffix}`;
  const highLabel = `${Number(chartMax.toFixed(1))}${metric.suffix}`;
  const lowLabel = `${Number(chartMin.toFixed(1))}${metric.suffix}`;
  return `
    <article class="item-card body-chart-card single-metric-chart">
      <div class="item-head">
        <div><strong>${escapeHtml(metric.label)} trend</strong><p class="muted">${escapeHtml(points[0].scan.scannedOn)} to ${escapeHtml(points[points.length - 1].scan.scannedOn)} · Change: ${escapeHtml(deltaText)}</p></div>
        <span class="pill">${scanMetric(latest, metric.suffix)}</span>
      </div>
      <div class="chart-unit-row"><span>${escapeHtml(highLabel)}</span><span>${escapeHtml(metric.suffix.trim() || "units")}</span></div>
      <div class="scan-chart-wrap">
        <svg viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeHtml(metric.label)} trend chart in ${escapeHtml(metric.suffix.trim() || "units")}">
          <line x1="${pad}" y1="${pad}" x2="${pad}" y2="${height - pad}" stroke="#d9f5c9" stroke-width="2" />
          <line x1="${pad}" y1="${height - pad}" x2="${width - pad}" y2="${height - pad}" stroke="#d9f5c9" stroke-width="2" />
          <polyline points="${polyPoints.join(" ")}" fill="none" stroke="${metric.color}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" />
          ${points.map((point) => `<circle cx="${x(point.index)}" cy="${y(point.value)}" r="5" fill="${metric.color}" />`).join("")}
        </svg>
      </div>
      <div class="chart-unit-row chart-unit-low"><span>${escapeHtml(lowLabel)}</span></div>
      <div class="metric-mini-foot chart-date-row"><span>${escapeHtml(points[0].scan.scannedOn)}</span><span>${escapeHtml(points[points.length - 1].scan.scannedOn)}</span></div>
    </article>
  `;
}

function initBodyMetricsApp() {
  const bodyScanPdf = document.getElementById("bodyScanPdf");
  const parseBodyScanBtn = document.getElementById("parseBodyScanBtn");
  const bodyScanPreview = document.getElementById("bodyScanPreview");
  const bodyScanList = document.getElementById("bodyScanList");
  const bodyScanChart = document.getElementById("bodyScanChart");
  const bodyScanChartMetric = document.getElementById("bodyScanChartMetric");
  let parsedBodyScan = null;
  let justSavedScan = null;
  let currentScans = [];
  if (!bodyScanList) return;

  async function renderScans() {
    try {
      const storedScans = await MangoFitnessStore.bodyScans();
      const scans = justSavedScan && !storedScans.some((scan) => scan.id === justSavedScan.id) ? [justSavedScan, ...storedScans] : storedScans;
      currentScans = scans;
      if (bodyScanChart) bodyScanChart.innerHTML = renderBodyScanChart(scans, bodyScanChartMetric?.value || "bodyWeight");
      bodyScanList.innerHTML = scans.length ? scans.slice(0, 10).map(renderBodyScanPreview).join("") : `<p class="muted empty-state">No body scans uploaded yet.</p>`;
    } catch (error) {
      bodyScanList.innerHTML = `<p class="muted empty-state">${escapeHtml(friendlyError(error))}</p>`;
    }
  }

  parseBodyScanBtn?.addEventListener("click", async () => {
    if (!bodyScanPdf?.files?.[0]) {
      if (bodyScanPreview) bodyScanPreview.innerHTML = `<p class="error-text">Choose a PDF first.</p>`;
      bodyScanPreview?.classList.remove("hidden");
      return;
    }
    try {
      parseBodyScanBtn.disabled = true;
      parseBodyScanBtn.textContent = "Scanning with AI...";
      try {
        parsedBodyScan = { ...(await aiParseBodyScanFile(bodyScanPdf.files[0])), athleteId: "" };
      } catch (aiError) {
        parseBodyScanBtn.textContent = "Using backup parser...";
        const text = await pdfTextFromFile(bodyScanPdf.files[0]);
        parsedBodyScan = { ...parseBodyScanText(text, bodyScanPdf.files[0].name), athleteId: "", notes: `Backup parser used. AI parser note: ${friendlyError(aiError)}` };
      }
      if (bodyScanPreview) {
        bodyScanPreview.innerHTML = renderBodyScanEditForm(parsedBodyScan);
        bodyScanPreview.classList.remove("hidden");
        document.getElementById("saveBodyScanBtn")?.addEventListener("click", async () => {
          const saveBtn = document.getElementById("saveBodyScanBtn");
          try {
            const scanToSave = applyScanEdits(parsedBodyScan, bodyScanPreview);
            if (!scanToSave.scannedOn) throw new Error("Add a scan date before saving.");
            if (saveBtn) {
              saveBtn.disabled = true;
              saveBtn.textContent = "Saving...";
            }
            justSavedScan = await MangoFitnessStore.saveBodyScan(scanToSave);
            parsedBodyScan = null;
            bodyScanPdf.value = "";
            bodyScanPreview.innerHTML = `<p class="success-text">Scan saved.</p>`;
            bodyScanPreview.classList.remove("hidden");
            await renderScans();
          } catch (saveError) {
            if (bodyScanPreview) bodyScanPreview.insertAdjacentHTML("afterbegin", `<p class="error-text">${escapeHtml(friendlyError(saveError))}</p>`);
          } finally {
            if (saveBtn) {
              saveBtn.disabled = false;
              saveBtn.textContent = "Save scan";
            }
          }
        });
      }
    } catch (error) {
      if (bodyScanPreview) bodyScanPreview.innerHTML = `<p class="error-text">${escapeHtml(friendlyError(error))}</p>`;
      bodyScanPreview?.classList.remove("hidden");
    } finally {
      parseBodyScanBtn.disabled = false;
      parseBodyScanBtn.textContent = "Parse PDF";
    }
  });

  bodyScanList.addEventListener("click", async (event) => {
    const editButton = event.target.closest("[data-scan-edit]");
    if (editButton) {
      event.preventDefault();
      const scan = currentScans.find((item) => item.id === editButton.dataset.scanEdit);
      const card = editButton.closest(".scan-history-card");
      const slot = card?.querySelector(".scan-edit-slot");
      if (scan && slot) {
        card.open = true;
        slot.innerHTML = renderBodyScanInlineEdit(scan);
        card.querySelector(".scan-history-details")?.classList.add("hidden");
      }
      return;
    }

    const cancelButton = event.target.closest("[data-scan-cancel-edit]");
    if (cancelButton) {
      event.preventDefault();
      const card = cancelButton.closest(".scan-history-card");
      card?.querySelector(".scan-edit-slot")?.replaceChildren();
      card?.querySelector(".scan-history-details")?.classList.remove("hidden");
      return;
    }

    const saveEditButton = event.target.closest("[data-scan-save-edit]");
    if (saveEditButton) {
      event.preventDefault();
      const scan = currentScans.find((item) => item.id === saveEditButton.dataset.scanSaveEdit);
      const form = saveEditButton.closest("[data-scan-edit-form]");
      if (!scan || !form) return;
      try {
        saveEditButton.disabled = true;
        saveEditButton.textContent = "Saving...";
        const updated = applyScanEdits(scan, form);
        if (!updated.scannedOn) throw new Error("Add a scan date before saving.");
        justSavedScan = await MangoFitnessStore.updateBodyScan(scan.id, updated);
        await renderScans();
      } catch (error) {
        form.insertAdjacentHTML("afterbegin", `<p class="error-text">${escapeHtml(friendlyError(error))}</p>`);
        saveEditButton.disabled = false;
        saveEditButton.textContent = "Save changes";
      }
      return;
    }

    const button = event.target.closest("[data-scan-delete]");
    if (!button) return;
    event.preventDefault();
    if (!confirm("Delete this body scan?")) return;
    try {
      button.disabled = true;
      button.textContent = "Deleting...";
      await MangoFitnessStore.deleteBodyScan(button.dataset.scanDelete);
      if (justSavedScan?.id === button.dataset.scanDelete) justSavedScan = null;
      await renderScans();
    } catch (error) {
      bodyScanList.insertAdjacentHTML("afterbegin", `<p class="error-text">${escapeHtml(friendlyError(error))}</p>`);
      button.disabled = false;
      button.textContent = "Delete";
    }
  });

  bodyScanChartMetric?.addEventListener("change", renderScans);
  renderScans();
}
