# MockMaster Admin Question Bank — Setup

## What is included

- Admin-only route: `/admin/questions`.
- Admin question authoring for all nine database question types.
- Exam, paper, subject, unit and topic classification.
- Question versions and separately stored answer keys.
- Draft → In review → Approved workflow, with return-to-draft and archive actions.
- Excel `.xlsx` / `.xls` first-sheet preview and basic row validation.
- Import batches and raw rows are written to the protected import staging tables.

Excel upload currently creates a review-staging batch. It does **not** automatically create question-bank records or publish questions. Row mapping, duplicate review and staged-row approval/import are follow-on workflow work.

## Required Supabase steps

Run these scripts in Supabase SQL Editor, in this order:

1. `supabase/migrations/202611130001_admin_question_bank_rpcs.sql`
2. `supabase/migrations/202611130002_admin_question_review_workflow.sql`

These scripts add narrowly scoped, security-definer RPCs. They require the Module 2 schema to have been installed already.

## Grant the first administrator

Replace the email below with the email address of the account that should administer MockMaster, then run this in Supabase SQL Editor:

```sql
update auth.users
set raw_app_meta_data =
  coalesce(raw_app_meta_data, '{}'::jsonb) || '{"role":"admin"}'::jsonb
where lower(email) = lower('YOUR_LOGIN_EMAIL');

select email, raw_app_meta_data ->> 'role' as role
from auth.users
where lower(email) = lower('YOUR_LOGIN_EMAIL');
```

Only grant this claim to a trusted administrator. Do not put admin role in editable `user_metadata`, and do not expose a Supabase service-role key in the browser.

After the update, sign out and sign back in so the browser receives a refreshed JWT. The dashboard will show the Admin panel link for an account with `app_metadata.role = admin`.

## Routes and access

- Admin workspace: `/admin/questions`
- Student dashboard: `/dashboard`

The page checks the signed-in user's `app_metadata.role`. Database RLS and RPC functions independently check the same server-controlled claim. Hiding the route in the UI is not the security boundary.

## Simple Excel question import

Use the **Download simple Excel template** button on `/admin/questions` → **Excel import**.

- One question per row; no JSON columns are required.
- Required: `exam_id`, `paper_id`, `subject_id`, `question`, `option_a`–`option_d`, and `correct_answer`.
- Optional: `unit_id`, `topic_id`, `question_format`, `stimulus`, `list_i`, `list_ii`, `explanation`, `difficulty`, `marks`, `negative_marks`, `source_label`, `source_year`.
- Taxonomy columns use the UUID IDs from the existing examination, paper, subject, unit and topic records.
- `correct_answer` is one letter only: A, B, C or D. Every imported format is stored as a single-choice response.
- For matching questions, put List I and List II in their own columns and provide four complete matching combinations as options A–D. Students choose one combination; no drag-and-drop or multi-select is used.
- For passage, case-study or data-interpretation sets, put shared text/data in `stimulus`; repeat it on each question row that uses it.
- `question_format` describes the presentation style. The student response remains one selected option.
- Imported questions are created as Draft and must be reviewed and approved before use in a test.

The old JSON-based master workbook is no longer required for new imports.

## Deployment

The code changes are committed to the `main` branch. If the Vercel project is connected to that branch with automatic deployments enabled, Vercel should start a deployment. Confirm the deployment status in Vercel before treating the route as live.
