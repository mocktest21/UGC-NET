# MockMaster database architecture — Module 2 (revised)

## Status and scope
This is the approved database foundation for MockMaster. The individual core and seed migrations remain available for reference. For the currently existing Supabase project, use `supabase/RESET_AND_INSTALL_MOCKMASTER.sql` as the single clean-rebuild script. It drops only the known MockMaster application tables and related enum/helper objects in `public`, then recreates the core schema, seeds UGC NET and runs verification. It preserves Supabase-managed schemas and `auth.users`. **The script has been committed to GitHub but has not been executed in Supabase.**

The design is examination-agnostic. UGC NET is the first configured examination; future examinations (SSC, UPSC, Banking and Railways) can use the same taxonomy and test engine.

## 1. Examination and syllabus hierarchy

The canonical hierarchy is:

`exams → papers → subjects → units → topics → questions`

For UGC NET:
- Paper 1 is a common/compulsory paper for all candidates.
- Paper 2 is selected by the candidate according to their subject.
- Paper 1 has one internal subject node named **General Paper**, under which its syllabus units are maintained. This keeps the database hierarchy consistent; the student UI should display Paper 1 directly and should not ask the student to choose General Paper.
- Paper 2 contains selectable subjects such as Commerce and Management. Additional NET subjects can be added as data, without schema changes.
- Student preferences store the selected exam and Paper 2 subject. Paper 1 is included automatically by the application logic.

Example:
```text
UGC NET
├── Paper 1 (compulsory)
│   └── General Paper
│       └── Units 1–10
└── Paper 2 (subject-specific)
    ├── Commerce
    │   └── Units 1–10
    ├── Management
    │   └── Units 1–17
    └── Other NET subjects
```

The exact syllabus and unit counts should be loaded from the applicable official syllabus; the example is a hierarchy illustration.

## 1A. Initial UGC NET seed configuration

The seed migration configures:
- Exam: UGC-NET.
- Paper 1: compulsory common paper; internal subject node `General Paper`, code `00`.
- Paper 2: compulsory subject-specific paper; students select one subject.
- Paper 2 subjects initially seeded: Commerce (NTA June 2026 code `008`, legacy UGC syllabus code `08`) and Management (NTA June 2026 code `017`, legacy UGC syllabus code `17`).
- Ten unit headings each for Paper 1, Commerce and Management.

The subject codes are stored as text to preserve leading zeros. Additional Paper 2 subjects should be added through seed/configuration data, not schema changes. The current seed deliberately starts with Commerce and Management rather than creating all listed NET subjects before their syllabi and content are ready.

The seed is idempotent and uses upserts. Run it only after the core schema migration. The verification script checks the two papers, both initial Paper 2 subjects and the expected ten units for each seeded syllabus.

Syllabus headings are based on the UGC-NET Bureau updated syllabus index (applicable from June 2019 onward). Subject-code labels follow the NTA June 2026 subject list. Always check the latest NTA bulletin and UGC syllabus index before publishing a new examination cycle; do not assume a historical syllabus is permanently current.

## 2. Master Question Bank

There is one central question record per canonical question. A question is classified by exam, paper, subject, unit, topic, question type, difficulty, language, source and workflow status.

Question lifecycle:
1. Uploaded / created as draft.
2. Validated for required fields, answer structure, taxonomy and media references.
3. Duplicate candidates are flagged for human review using a normalized fingerprint and similarity checks.
4. Admin reviews and approves the question.
5. Approved questions become eligible for practice generation and admin test assembly.

Do not silently merge or delete suspected duplicates. The import workflow records the candidate matches for admin review.

### Supported question types
- `single_choice`
- `multiple_choice`
- `assertion_reason`
- `matching`
- `passage`
- `numerical`
- `short_answer`
- `ordering`
- `true_false`

Prompt, options, stimulus, media and explanation are JSONB payloads in `question_versions`. Answer keys are stored separately in protected tables.

Example prompt:
```json
{
  "stem": { "text": "Question text", "html": null },
  "instructions": null,
  "assets": []
}
```

Example options:
```json
[
  { "id": "A", "text": "Option text" },
  { "id": "B", "text": "Option text" }
]
```

Answer-key examples (server/admin only):
- Single choice: `{"correct_option_id":"B"}`
- Multiple choice: `{"correct_option_ids":["A","C"]}`
- Matching: `{"pairs":[{"left_id":"L1","right_id":"R2"}]}`
- Numerical: `{"accepted_value":42,"tolerance":0.01}`
- True/false: `{"value":true}`

Passage-based questions initially use shared stimulus JSON. If passage authoring becomes complex, a dedicated passage entity can be introduced later.

## 3. Question versioning and historical integrity

`questions` stores stable identity and taxonomy. `question_versions` stores versioned prompt/options/media/explanation/marking metadata. `question_version_answer_keys` stores the matching protected answer key.

Every test-question row references an exact `question_version_id`. When a bank question is edited, a new version is created; previously published tests continue to reference the old version. Never update a published version in place.

For test-specific marking or answer interpretation, `test_question_answer_keys` stores a protected snapshot. The student-facing test query must never select answer-key tables.

## 4. Imports and pre-made tests

`question_import_batches` records each Excel/CSV import. `question_import_items` stores row-level raw data, parsed data, validation errors, duplicate candidates and import status.

For questions uploaded as part of a pre-made test:
1. Parse and validate the rows.
2. Match each row to an existing approved question where possible.
3. Create a new Master Question Bank question only when needed.
4. Route new questions through review and approval.
5. Build the fixed test by linking approved question IDs and immutable version IDs.

This prevents separate, disconnected copies of the same question from accumulating. A question can be reused in multiple tests.

## 5. Two test creation paths, one test engine

### Admin-created tests
Admins create fixed practice tests or scheduled live tests, choose approved question versions, set order/marks/negative marks, duration, availability window, attempt limits and result visibility.

### Student-generated practice tests
Students choose exam, paper, Paper 2 subject where relevant, units/topics, question count, difficulty and selection strategy. The server-side generator selects eligible questions and creates a generated test instance with a frozen question-version list. This test instance is then handled by the same test engine as an admin-created test.

Selection strategies can include:
- New / never attempted questions.
- Incorrectly answered questions.
- Bookmarked questions.
- Mixed revision.
- Exclude previously attempted questions.
- Balanced difficulty distribution.

The generation operation must be implemented as a secure server-side RPC or trusted server endpoint. Do not grant students direct insert/update access to tests or test_questions.

## 6. Attempts, responses and analytics

- `test_attempts`: one student attempt against one test instance.
- `student_responses`: one response per test-question within an attempt, including review state, visit state and time spent.
- `bookmarks` and `personal_notes`: student-owned notebook data.
- Overall, paper-wise, subject-wise, unit-wise and question-wise analytics should be derived from submitted attempts and responses. Relative standing/percentiles require a defined comparison cohort and should not be shown until enough valid cohort data exists.

Store timestamps and response timing at question level. Average time per question can be derived from completed attempts.

## 7. Security model

1. Admin status is determined only from the server-controlled JWT claim `app_metadata.role = admin`. Never grant admin rights using editable `user_metadata`.
2. Answer keys are in separate tables with admin-only RLS. Student clients must not receive these rows.
3. Students can read their own attempts and responses, but cannot directly insert or update them.
4. Test start, response save, timer validation, auto-submit, scoring and dynamic test generation must be implemented through narrowly scoped secure RPCs or trusted server endpoints.
5. Do not put Supabase `service_role` in a `NEXT_PUBLIC_` variable or commit it to GitHub.
6. Import staging and audit logs are admin-only.
7. Test RLS with anonymous, student and admin identities before production.

## 8. Main table inventory

| Area | Tables |
|---|---|
| Identity | `profiles`, `student_exam_preferences` |
| Taxonomy | `exams`, `papers`, `subjects`, `units`, `topics` |
| Master bank | `questions`, `question_versions`, `question_answer_keys`, `question_version_answer_keys` |
| Import pipeline | `question_import_batches`, `question_import_items` |
| Test delivery | `tests`, `test_questions`, `test_question_answer_keys` |
| Attempts | `test_attempts`, `student_responses` |
| Student notebook | `bookmarks`, `personal_notes` |
| Governance | `admin_audit_logs` |

## 9. Rollout plan

1. Review both SQL migrations and validate them in a disposable Supabase project first.
2. Run the UGC NET seed migration after the core schema migration.
3. Run `supabase/verification/verify_ugc_net_seed.sql` and inspect the hierarchy output.
4. Confirm the Paper 1 compulsory flag, Paper 2 subject selection and the seeded syllabus titles.
3. Build admin question bank and import validation.
4. Build admin test builder and publication workflow.
5. Implement secure test-engine RPCs for starting attempts, saving responses, timer enforcement, submission and evaluation.
6. Implement student-generated practice tests through a secure generator.
7. Build analytics from real attempts.
8. Load-test and security-test before allowing high concurrency.

**This GitHub commit does not execute SQL in Supabase.** When the schema is approved, copy the migration into Supabase SQL Editor and run it there. Do not run the previous version of this migration.

## Student practice and live-test question lifecycle (2026-11-13)

The question bank remains the single source of truth. Practice and live tests reference immutable question versions; they do not copy question content into a second bank.

- **Question formats:** the existing `question_type` enum is the supported format catalogue: single choice, multiple choice, assertion–reason, matching, passage, numerical, short answer, ordering, and true/false. The student practice renderer supports option selection, multi-selection, boolean, numeric/text, and structured JSON responses for matching/ordering and other structured formats.
- **Unseen-first selection:** `student_start_practice_test` selects eligible approved questions not previously presented in a submitted/auto-submitted attempt first. If the unseen pool is smaller than the requested test size, it fills the remaining places from previously presented questions. The generated test and attempt are persisted in `tests`, `test_questions`, `test_attempts`, and `student_responses`.
- **Automatic live release:** a question already in the central bank is temporarily withheld from generated practice while it belongs to a published live test whose `ends_at` is still in the future. Once the live window closes, the same question record/version becomes eligible automatically. No question duplication or manual transfer job is used.
- **Security:** student writes go through authenticated security-definer RPCs. Answer-key snapshots remain in the existing protected table and are not selected by the practice UI.
- **Migration:** apply `supabase/migrations/202611130004_student_practice_unseen_live_transfer.sql` in Supabase SQL Editor after the existing core schema and test-builder migrations. This is additive and does not drop or reset existing data.
