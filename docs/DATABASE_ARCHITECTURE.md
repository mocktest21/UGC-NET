# MockMaster database architecture — Module 2

## Scope
This migration establishes the shared database foundation for Practice and Live Test. It supports UGC NET Paper 1, Commerce, Management and future exam families.

## Files
- supabase/migrations/202611120001_mockmaster_core_schema.sql — schema, indexes, RLS and profile creation trigger.
- This document — relationships, payload examples and rollout notes.

## Core relationships
- auth.users → profiles
- exams → subjects → units → topics
- questions → question_answer_keys (private answer and evaluation rules)
- tests → test_questions → questions
- test_attempts → student_responses → questions

## Flexible question formats
The prompt and options use JSONB, while question_type is an explicit enum.

| Type | Suggested response / answer structure |
|---|---|
| single_choice | One selected option ID; answer key has correct_option_id |
| multiple_choice | Array of selected option IDs; answer key has correct_option_ids |
| assertion_reason | Assertion and reason in prompt; standard combination options |
| matching | Map left-side IDs to right-side IDs; answer key stores expected pairs |
| passage | Shared stimulus/passage plus linked question records |
| numerical | Numeric response; answer key stores accepted value/range and tolerance |
| short_answer | Text response; evaluation rules define exact, normalised or manual marking |
| ordering | Ordered array of item IDs |
| true_false | Boolean response |

Common prompt example:
{
  "stem": { "text": "Question text", "html": null },
  "instructions": null,
  "assets": []
}

Common options example:
[
  { "id": "A", "text": "Option text" },
  { "id": "B", "text": "Option text" }
]

Answer key examples (only in question_answer_keys):
- Single choice: { "correct_option_id": "B" }
- Multiple choice: { "correct_option_ids": ["A", "C"] }
- Matching: { "pairs": [{"left_id":"L1","right_id":"R2"}] }
- Numerical: { "accepted_value": 42, "tolerance": 0.01 }
- True/false: { "value": true }

Passage questions should initially be separate question records sharing stimulus JSON. A dedicated passages table can be added if the authoring workflow requires it. test_questions stores test-specific order and marks, allowing a question to be reused across tests.

## Security decisions
1. Correct answers are physically separated into question_answer_keys. Never include answer keys in browser-readable question payloads.
2. Admin authorization reads the server-controlled JWT claim app_metadata.role = admin. Never use editable user_metadata to grant admin rights.
3. Students can read their own profile, attempts and responses. Attempt/response writes are intentionally blocked until secure test-engine RPCs exist; this prevents client-side score and timer tampering.
4. The Supabase service_role key must remain server-only and must never be added to a NEXT_PUBLIC_ variable or committed to GitHub.
5. Anonymous users can read the active exam/syllabus catalogue only. Question and test content requires authentication.

## Apply the migration
1. Open the MockMaster Supabase project.
2. Go to SQL Editor → New query.
3. Open the migration SQL file from this repository and copy its complete contents.
4. Paste and run it once.
5. Confirm these tables appear in Table Editor: profiles, exams, subjects, units, topics, questions, question_answer_keys, tests, test_questions, test_attempts, student_responses.
6. Check that a newly registered user receives a profiles row. Users created before this trigger are not backfilled by this migration; a later safe backfill can populate them.

This repository commit does not execute SQL in the Supabase project. Run the SQL in the Supabase dashboard before application code uses these tables.

## Deferred to Module 3
- Admin role assignment workflow and admin UI.
- Excel/CSV import staging, validation reports and bulk publish.
- Secure RPCs for starting attempts, saving responses, timer enforcement, auto-submit and scoring.
- Live-test concurrency strategy and load tests.
- Analytics views/materialized aggregates and percentile cohorts.
- Payment/subscription entitlements.

## Implementation notes
- Do not let browsers insert/update test_attempts or student_responses directly. Add narrowly scoped SECURITY DEFINER RPCs when the test rules are finalised.
- time_spent_seconds is stored per response; average time per question can be derived for submitted attempts.
- Large imports should use staging tables and batched inserts.
- Before production, validate payload shape for each question type and test RLS with student, admin and anonymous JWTs.
