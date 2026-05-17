# Mango Fitness Notes from 2026-05-16

These notes preserve the important project details from yesterday’s work.

## Layout direction Lawrence approved

- Keep the Mango Fitness layout direction with weekly Saved Workouts calendar and filters.
- Keep the class/everyone vs individual athlete programming model.
- Saved Workouts filter behavior:
  - Everyone/class filter shows group workouts only.
  - Selecting an athlete shows only that athlete’s individual workouts.
- Related commit: `7cd8911 Show only individual workouts in athlete filter`.

## iPhone layout lessons

Lawrence cares that the app feels clean on iPhone portrait and landscape. Input bubbles must not run past the card width.

Important layout commits/state:

- `c6fa65d Fix iPhone date input width` — fixed native iOS date input overflow/misalignment.
- `fd50d70 Stack workout fields on phone landscape` — stacked top workout fields in phone landscape to prevent Day title overflow.
- `09cb2bb Use full width on phone landscape` — makes phone landscape page/card area full width.
- `52a77ab Contain form inputs on phone landscape` — keeps form input bubbles inside card bounds.
- `5b18c3e Move signed-in status to landscape header corner` — moves signed-in status to top-right in phone landscape.

Two landscape/header cleanup attempts were reversed because Lawrence disliked them:

- `c537969 Revert "Simplify coach layout on phone landscape"`
- `3350a1e Revert "Clean up phone landscape header and fields"`

Preserve this lesson: do not make aggressive landscape/header/logo changes unless Lawrence asks.

## Workout Builder

- Workout Builder sections should stay collapsible to reduce scrolling.
- Collapsible sections added for:
  - Warm-up
  - Weightlifting / Strength
  - Cardio / WOD
- Related commit: `1450573 Add collapsible workout builder sections`.

## Athlete page split

Lawrence felt the Athlete Portal became cluttered when Body Metrics and Progress History were inside it.

Current direction:

- `athlete.html` focuses on training/workouts only.
- `athlete-metrics.html` handles InBody/BodySpec upload, body scan review, scan history, and body metric charts.
- `athlete-history.html` handles workout/progress history.
- Athlete-facing pages should not include Coach Dashboard/Coach Portal links.
- Related commit: `c88bd3d Remove coach link from athlete pages`.

## Body metrics and InBody parsing

- Body Metrics page is athlete-facing only.
- No athlete selector on Body Metrics.
- Uploads and scan history should be locked to the signed-in athlete’s own profile/account.
- Related commit: `c412364 Lock body scans to signed-in athlete`.

Lawrence wants athletes to upload their own InBody scans and see history in chart form.

Current chart metrics:

- Weight
- Body Fat %
- Skeletal Muscle Mass

Chart appears when at least two scans exist.
Related commit: `ff73442 Chart athlete body scan history`.

## Body scan review/editing

Body scan import review must be editable before save because OCR can be wrong.

Save button should be visible at the top of the review card.

Editable fields include:

- Scan date
- Weight
- Body fat %
- Fat mass
- Skeletal muscle
- BMI
- BMR/RMR
- Visceral fat level

Related commit: `d838c6d Make scan import review editable`.

## InBody parser priorities

Fields Lawrence cares about most:

- Date of scan
- Weight
- SMM / Skeletal Muscle Mass
- PBF / Percent Body Fat

Filename date fallback should work for names like:

- `InBody_2026.4.12.pdf`

Related commit: `2a82c9c Improve InBody core metric parsing`.

Important parser lesson:

- Pulling wrong data is worse than leaving fields blank.
- Parser should be conservative.
- Avoid aggressive table guessing.
- Validate internal consistency.
- Leave uncertain SMM/PBF/weight blank for review instead of saving bad numbers.

Related commit: `c5af5ba Make InBody parsing conservative`.

If Lawrence reports bad parsing from a screenshot, ask for the actual PDF file because screenshots do not expose the raw PDF/OCR text.

## Mango Loan side work during same session

Mango Loan was briefly updated during the session:

- `a670db1 Clean up stale admin MFA factors`
- `991072d Brighten Mango Loan theme`

Then work returned to Mango Fitness.
