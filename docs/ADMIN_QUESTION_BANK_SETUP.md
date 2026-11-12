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

## Excel staging columns

Required for current basic staging validation:

- `question`
- `correct_answer`

Recommended columns for the next import-mapping phase:

- `option_a`, `option_b`, `option_c`, `option_d`
- `question_type`
- `exam_code`, `paper_code`, `subject_code`, `unit_number`
- `explanation`, `marks`, `negative_marks`

Maximum batch size: 5,000 rows. The first worksheet is used. Column headers are normalized to lowercase before validation.

## Deployment

The code changes are committed to the `main` branch. If the Vercel project is connected to that branch with automatic deployments enabled, Vercel should start a deployment. Confirm the deployment status in Vercel before treating the route as live.
