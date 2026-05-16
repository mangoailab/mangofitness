const MangoFitnessStore = (() => {
  const workoutKey = "mangoFitness.workouts.v1";
  const resultKey = "mangoFitness.results.v1";

  function read(key) {
    try { return JSON.parse(localStorage.getItem(key) || "[]"); }
    catch { return []; }
  }

  function write(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
    window.dispatchEvent(new Event("mangoFitness:dataChanged"));
  }

  return {
    workouts: () => read(workoutKey),
    results: () => read(resultKey),
    saveWorkout(workout) {
      const workouts = read(workoutKey).filter((item) => item.id !== workout.id);
      workouts.push(workout);
      write(workoutKey, workouts.sort((a, b) => a.date.localeCompare(b.date)));
    },
    deleteWorkout(id) {
      write(workoutKey, read(workoutKey).filter((item) => item.id !== id));
    },
    saveResult(result) {
      const results = read(resultKey).filter((item) => item.id !== result.id);
      results.push(result);
      write(resultKey, results.sort((a, b) => b.completedOn.localeCompare(a.completedOn)));
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

  function setAppMessage(text) {
    message.textContent = text || "";
    message.classList.toggle("hidden", !text);
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
      id: row.dataset.exerciseId || uid("exercise"),
      name: row.querySelector(".exercise-name").value.trim(),
      sets: row.querySelector(".exercise-sets").value.trim(),
      reps: row.querySelector(".exercise-reps").value.trim(),
      target: row.querySelector(".exercise-target").value.trim(),
      notes: row.querySelector(".exercise-notes").value.trim()
    })).filter((exercise) => exercise.name);
  }

  function editWorkout(id) {
    const workout = MangoFitnessStore.workouts().find((item) => item.id === id);
    if (!workout) return;
    form.dataset.editId = workout.id;
    date.value = workout.date;
    title.value = workout.title;
    notes.value = workout.notes || "";
    rows.innerHTML = "";
    workout.exercises.forEach(addExerciseRow);
    window.scrollTo({ top: form.offsetTop - 20, behavior: "smooth" });
  }

  function renderCoach() {
    const workouts = MangoFitnessStore.workouts();
    const results = MangoFitnessStore.results();
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

    list.querySelectorAll("[data-edit]").forEach((button) => button.addEventListener("click", () => editWorkout(button.dataset.edit)));
    list.querySelectorAll("[data-delete]").forEach((button) => button.addEventListener("click", () => {
      MangoFitnessStore.deleteWorkout(button.dataset.delete);
      renderCoach();
    }));
  }

  document.getElementById("addExerciseBtn")?.addEventListener("click", () => addExerciseRow());
  document.getElementById("clearWorkoutBtn")?.addEventListener("click", clearForm);
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const exercises = collectExercises();
    if (!date.value || !title.value.trim()) return setAppMessage("Add a workout date and title.");
    if (!exercises.length) return setAppMessage("Add at least one exercise.");

    MangoFitnessStore.saveWorkout({
      id: form.dataset.editId || uid("workout"),
      date: date.value,
      title: title.value.trim(),
      notes: notes.value.trim(),
      exercises
    });
    clearForm();
    setAppMessage("Workout saved. Athletes can see it from their portal on the same device.");
    renderCoach();
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

  function renderAthlete() {
    const workouts = MangoFitnessStore.workouts();
    const workout = workouts.find((item) => item.date === date.value) || workouts[workouts.length - 1];
    const results = MangoFitnessStore.results();

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
      form.addEventListener("submit", (event) => {
        event.preventDefault();
        const data = new FormData(form);
        MangoFitnessStore.saveResult({
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
        renderAthlete();
      });
    });
  }

  date.addEventListener("change", renderAthlete);
  window.addEventListener("mangoFitness:dataChanged", renderAthlete);
  renderAthlete();
}
