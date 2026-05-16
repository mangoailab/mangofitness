const MangoFitnessStore = (() => {
  const localWorkoutKey = "mangoFitness.workouts.v1";
  const localResultKey = "mangoFitness.results.v1";

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
      exercises: (row.workout_exercises || []).sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0)).map((exercise) => ({
        id: exercise.id,
        name: exercise.exercise_name,
        sets: exercise.sets || "",
        reps: exercise.reps || "",
        target: exercise.target || "",
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
      exerciseName: exercise.exercise_name || "Exercise",
      completedOn: row.completed_on,
      weight: row.working_weight ?? "",
      reps: row.reps_completed || "",
      notes: row.notes || "",
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
    async workouts() {
      const sb = client();
      if (!sb) return readLocal(localWorkoutKey);

      const { data, error } = await sb
        .from("workouts")
        .select("id, workout_date, title, notes, workout_exercises (id, exercise_name, sets, reps, target, notes, sort_order)")
        .order("workout_date", { ascending: true });

      if (error) throw error;
      return (data || []).map(normalizeWorkout);
    },

    async results() {
      const sb = client();
      if (!sb) return readLocal(localResultKey);

      const { data, error } = await sb
        .from("athlete_workout_results")
        .select("id, workout_exercise_id, completed_on, working_weight, reps_completed, notes, is_pr, workout_exercises (exercise_name, workout_id)")
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

function friendlyError(error) {
  const message = error?.message || String(error || "Something went wrong.");
  if (message.includes("relation") && message.includes("does not exist")) {
    return "Supabase tables are not created yet. Apply supabase/schema-draft.sql in the Supabase SQL editor.";
  }
  return message;
}

function initCoachApp() {
  const form = document.getElementById("workoutForm");
  if (!form) return;

  const date = document.getElementById("workoutDate");
  const title = document.getElementById("workoutTitle");
  const notes = document.getElementById("workoutNotes");
  const rows = document.getElementById("exerciseRows");
  const list = document.getElementById("coachWorkoutList");
  const resultsList = document.getElementById("coachResultsList");
  const count = document.getElementById("workoutCount");
  const message = document.getElementById("coachAppMessage");

  date.value = todayISO();

  function setAppMessage(text, isError = false) {
    message.textContent = text || "";
    message.classList.toggle("hidden", !text);
    message.classList.toggle("error-text", Boolean(isError));
  }

  function addExerciseRow(values = {}) {
    const row = document.createElement("div");
    row.className = "exercise-row";
    row.dataset.exerciseId = values.id || uid("exercise");
    row.innerHTML = `
      <div class="field"><label>Exercise</label><input class="exercise-name" type="text" placeholder="Back squat" value="${escapeHtml(values.name)}" required /></div>
      <div class="mini-grid">
        <div class="field"><label>Sets</label><input class="exercise-sets" type="text" placeholder="4" value="${escapeHtml(values.sets)}" /></div>
        <div class="field"><label>Reps</label><input class="exercise-reps" type="text" placeholder="6" value="${escapeHtml(values.reps)}" /></div>
        <div class="field"><label>Target</label><input class="exercise-target" type="text" placeholder="75% or RPE 7" value="${escapeHtml(values.target)}" /></div>
      </div>
      <div class="field"><label>Notes</label><input class="exercise-notes" type="text" placeholder="Tempo, rest, cues" value="${escapeHtml(values.notes)}" /></div>
      <button type="button" class="remove-row">Remove</button>
    `;
    row.querySelector(".remove-row").addEventListener("click", () => row.remove());
    rows.appendChild(row);
  }

  function clearForm() {
    form.dataset.editId = "";
    date.value = todayISO();
    title.value = "";
    notes.value = "";
    rows.innerHTML = "";
    addExerciseRow();
    setAppMessage("");
  }

  function collectExercises() {
    return [...rows.querySelectorAll(".exercise-row")].map((row) => ({
      id: row.dataset.exerciseId,
      name: row.querySelector(".exercise-name").value.trim(),
      sets: row.querySelector(".exercise-sets").value.trim(),
      reps: row.querySelector(".exercise-reps").value.trim(),
      target: row.querySelector(".exercise-target").value.trim(),
      notes: row.querySelector(".exercise-notes").value.trim()
    })).filter((exercise) => exercise.name);
  }

  async function editWorkout(id) {
    const workout = (await MangoFitnessStore.workouts()).find((item) => item.id === id);
    if (!workout) return;
    form.dataset.editId = workout.id;
    date.value = workout.date;
    title.value = workout.title;
    notes.value = workout.notes || "";
    rows.innerHTML = "";
    workout.exercises.forEach(addExerciseRow);
    window.scrollTo({ top: form.offsetTop - 20, behavior: "smooth" });
  }

  async function renderCoach() {
    try {
      const workouts = await MangoFitnessStore.workouts();
      const results = await MangoFitnessStore.results();
      count.textContent = `${workouts.length} workout${workouts.length === 1 ? "" : "s"}`;

      list.innerHTML = workouts.length ? workouts.map((workout) => `
        <article class="item-card">
          <div class="item-head">
            <div><strong>${escapeHtml(workout.title)}</strong><p class="muted">${escapeHtml(workout.date)} · ${workout.exercises.length} exercises</p></div>
            <div class="actions item-actions">
              <button type="button" data-edit="${workout.id}">Edit</button>
              <button type="button" data-delete="${workout.id}">Delete</button>
            </div>
          </div>
          ${workout.notes ? `<p>${escapeHtml(workout.notes)}</p>` : ""}
          <ul class="clean-list">${workout.exercises.map((exercise) => `<li><strong>${escapeHtml(exercise.name)}</strong> — ${escapeHtml(exercise.sets || "-")} x ${escapeHtml(exercise.reps || "-")} ${exercise.target ? `· ${escapeHtml(exercise.target)}` : ""}</li>`).join("")}</ul>
        </article>
      `).join("") : `<p class="muted empty-state">No workouts saved yet. Build the first one above.</p>`;

      resultsList.innerHTML = results.length ? results.map((result) => `
        <article class="item-card">
          <strong>${escapeHtml(result.exerciseName)}</strong>
          <p class="muted">${escapeHtml(result.completedOn)} · ${escapeHtml(result.weight || "-")} lb · ${escapeHtml(result.reps || "-")} reps${result.isPr ? " · PR" : ""}</p>
          ${result.notes ? `<p>${escapeHtml(result.notes)}</p>` : ""}
        </article>
      `).join("") : `<p class="muted empty-state">No athlete results logged yet.</p>`;

      list.querySelectorAll("[data-edit]").forEach((button) => button.addEventListener("click", () => editWorkout(button.dataset.edit).catch((error) => setAppMessage(friendlyError(error), true))));
      list.querySelectorAll("[data-delete]").forEach((button) => button.addEventListener("click", async () => {
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

  document.getElementById("addExerciseBtn")?.addEventListener("click", () => addExerciseRow());
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
        exercises
      });
      clearForm();
      setAppMessage(savedId ? "Workout saved to Supabase." : "Workout saved.");
      await renderCoach();
    } catch (error) {
      setAppMessage(friendlyError(error), true);
    }
  });

  clearForm();
  renderCoach();
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
            <div class="list-stack">
              ${workout.exercises.map((exercise) => `
                <form class="result-form" data-workout-id="${workout.id}" data-exercise-id="${exercise.id}" data-exercise-name="${escapeHtml(exercise.name)}">
                  <div>
                    <strong>${escapeHtml(exercise.name)}</strong>
                    <p class="muted">${escapeHtml(exercise.sets || "-")} sets · ${escapeHtml(exercise.reps || "-")} reps${exercise.target ? ` · ${escapeHtml(exercise.target)}` : ""}</p>
                    ${exercise.notes ? `<p>${escapeHtml(exercise.notes)}</p>` : ""}
                  </div>
                  <div class="mini-grid">
                    <div class="field"><label>Weight</label><input name="weight" type="number" min="0" step="0.5" placeholder="lb" /></div>
                    <div class="field"><label>Reps done</label><input name="reps" type="text" placeholder="6,6,5,5" /></div>
                    <label class="check-field"><input name="isPr" type="checkbox" /> PR</label>
                  </div>
                  <div class="field"><label>Notes</label><input name="notes" type="text" placeholder="How it felt" /></div>
                  <button type="submit" class="primary">Log result</button>
                </form>
              `).join("")}
            </div>
          </article>
        `;
      }

      history.innerHTML = results.length ? results.map((result) => `
        <article class="item-card">
          <strong>${escapeHtml(result.exerciseName)}</strong>
          <p class="muted">${escapeHtml(result.completedOn)} · ${escapeHtml(result.weight || "-")} lb · ${escapeHtml(result.reps || "-")} reps${result.isPr ? " · PR" : ""}</p>
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
