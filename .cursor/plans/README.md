# Cursor Plans

Plans provide task-specific context for ongoing work across Cursor chat sessions.

## Purpose

- Give the next Cursor session enough context to continue without re-reading the full chat history.
- Record decisions, constraints, and risks for a concrete task.
- Separate temporary task context from permanent project rules.

## Naming convention

```
YYYY-MM-DD_short-task-description.md
```

Example: `2026-09-08_shop-area-verification.md`

## When to create a plan

- The task spans multiple sessions or multiple files.
- Non-obvious architectural decisions are made.
- There are constraints (e.g. "do not touch payment scope files").
- The task has a clear final state that should be documented.

**Do not** create a plan for trivial single-file changes that complete in one session.

## When to update a plan

- After completing a meaningful chunk of work.
- When a decision changes.
- When new risks or constraints are discovered.

## When to archive a plan

When the task is complete and verified. Move to `archive/` and document the final state.

## What a plan is NOT

- A copy of the chat history.
- A repeat of rules from `.cursor/rules/`.
- A full project specification.
- A bug tracker (use GitHub issues for that).

## Structure

Use the template in `active/TEMPLATE.md`. Keep it short – only what is needed to continue the task.
