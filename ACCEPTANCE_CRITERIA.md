# Acceptance Criteria - Aggressive ICTX Coach Mode

## Product Scope

- [ ] The app remains a web app and supports workflows targeting Bkool Smart Bike + ICTraining (Mac/Windows).
- [ ] Workout generation is driven by FTP-relative intensity (%FTP / level ratio), not only static manual blocks.
- [ ] The new behavior is coach/generator oriented (rule-based), clearly differentiated from a classic block builder.

## Core Training Behavior

- [ ] Cadence is explicitly prescribed per interval (rpm target is mandatory in main blocks).
- [ ] Workouts enforce alternation between:
- [ ] High cadence + lower/moderate force segments.
- [ ] Low cadence + high force (torque) segments.
- [ ] Main set is aggressive: short intervals, high density, short recoveries.
- [ ] Sessions feel varied and surprising (micro-variability in durations/intensity/cadence).
- [ ] Non-repetitive behavior is available via randomness/seeded variation.

## 45-Minute Priority Mode

- [ ] For 45-minute sessions, the main set is predominantly short-interval based (avoid long steady blocks in main work).
- [ ] Warmup and cooldown can exist, but the core workload remains punchy, dynamic, and interval-heavy.

## User Controls

- [ ] User can configure at least:
- [ ] Duration.
- [ ] Focus (Cadence / Torque / Mixed / Over-Under style).
- [ ] Aggressiveness (Cruelty-like control).
- [ ] Seed/randomization behavior for repeatable or fresh variants.

## ICTX Export Compatibility

- [ ] Export produces `.ictx` files importable by ICTraining.
- [ ] Export includes ratio-based structure (`ratioExercise=true`).
- [ ] Export includes `workoutStruct=ratio;...` timeline serialization.
- [ ] Export includes sequence legs with `duration`, `levelRatio`, and `rpm`.
- [ ] Exported timeline duration matches generated workout duration.

## UX and Validation

- [ ] User can preview workout intervals before export (table/timeline-level visibility).
- [ ] Generated workout always includes coherent structure (warmup/main/finisher/cooldown or equivalent).
- [ ] Type safety passes (`tsc --noEmit`).
- [ ] Automated tests cover generator logic and ICTX export consistency.

## Definition of Done (Practical)

- [ ] A 45-minute aggressive mixed session can be generated with visible cadence flips and torque punches.
- [ ] The generated `.ictx` imports successfully in ICTraining.
- [ ] Exported structure and durations are internally consistent.
- [ ] The behavior is clearly more aggressive, varied, and less predictable than a standard builder flow.

## Audit Tracker

Use this table to track real implementation status with objective evidence.

Legend for `Status`: `Not Started` | `In Progress` | `Passed` | `Failed` | `Blocked`

| ID | Criterion | Status | Evidence | Notes |
| --- | --- | --- | --- | --- |
| AC-01 | Web app workflow targets Bkool Smart Bike + ICTraining (Mac/Windows). | Not Started |  |  |
| AC-02 | Generator uses FTP-relative intensity (%FTP / level ratio). | Not Started |  |  |
| AC-03 | Coach/generator behavior is distinct from classic manual block builder. | Not Started |  |  |
| AC-04 | Cadence target is explicit per interval in main blocks. | Not Started |  |  |
| AC-05 | Alternation exists: high cadence + lower/moderate force. | Not Started |  |  |
| AC-06 | Alternation exists: low cadence + high force (torque). | Not Started |  |  |
| AC-07 | Main set is aggressive (short intervals, high density, short recoveries). | Not Started |  |  |
| AC-08 | Session includes micro-variability and surprise behavior. | Not Started |  |  |
| AC-09 | Non-repetitive behavior supports randomness/seed variation. | Not Started |  |  |
| AC-10 | 45-minute mode keeps main set predominantly short-interval based. | Not Started |  |  |
| AC-11 | Core workload remains dynamic and interval-heavy (warmup/cooldown allowed). | Not Started |  |  |
| AC-12 | User can set duration. | Not Started |  |  |
| AC-13 | User can set focus (Cadence / Torque / Mixed / Over-Under). | Not Started |  |  |
| AC-14 | User can set aggressiveness (Cruelty-like control). | Not Started |  |  |
| AC-15 | User can control seed/randomization for repeatable/fresh variants. | Not Started |  |  |
| AC-16 | Exported `.ictx` imports in ICTraining. | Not Started |  |  |
| AC-17 | ICTX export contains `ratioExercise=true`. | Not Started |  |  |
| AC-18 | ICTX export contains `workoutStruct=ratio;...`. | Not Started |  |  |
| AC-19 | ICTX export legs include `duration`, `levelRatio`, and `rpm`. | Not Started |  |  |
| AC-20 | Exported timeline duration matches generated workout duration. | Not Started |  |  |
| AC-21 | UI shows interval preview before export. | Not Started |  |  |
| AC-22 | Generated workout structure is coherent (warmup/main/finisher/cooldown or equivalent). | Not Started |  |  |
| AC-23 | Type check passes (`tsc --noEmit`). | Not Started |  |  |
| AC-24 | Automated tests cover generator logic and ICTX consistency. | Not Started |  |  |
| AC-25 | 45-minute aggressive mixed session shows cadence flips + torque punches. | Not Started |  |  |
| AC-26 | Behavior is more aggressive, varied, and less predictable than standard builder flow. | Not Started |  |  |
