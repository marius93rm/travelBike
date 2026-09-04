# Agent Operating Contract

This repository contains travelBike, an app for finding train journeys that work with a bicycle. Keep changes scoped to the product and its user experience.

## Core Rules

- Explore the repository before asking questions; prefer local evidence and `rg`/`rg --files`.
- Keep changes limited to the request. Preserve user work and never revert unrelated edits.
- Verify before reporting completion. State checks run, checks skipped, and residual risk.
- Do not add global machine configuration, credentials, telemetry, providers, or personal paths.
- Call out security and compatibility risks explicitly.
- Treat bicycle carriage rules, service availability, fares, and timetable data as time-sensitive; preserve source and update-time metadata when implementing them.
- Keep provider-specific integrations behind stable domain boundaries so the product can support more than one railway operator.

## Workflow

1. Identify the goal and affected surface.
2. Inspect only the relevant files, configs, tests, schemas, and documentation.
3. Choose the smallest defensible implementation.
4. Make focused edits.
5. Run verification proportional to the risk.
6. Summarize changes, evidence, and remaining uncertainty.

Plan first for large, ambiguous, or risky work. Small fixes can proceed after inspection.

## Context Discipline

- Map with filenames and targeted search before reading file bodies.
- Read the smallest useful section; do not dump whole catalogs, logs, or generated files when a focused query answers the question.
- Shape command output with filters and explicit budgets. Preserve a path or command for follow-up instead of embedding noise.
- Do not reread unchanged material. Keep stable decisions in repo files and retrieve details just in time.
- Stop exploring once the implementation decision is supported by enough evidence.
- Keep handoffs and final reports compact: conclusions first, then decisive evidence and gaps.

## Agents and Skills

Start with the main Codex agent. Use a project-local specialist when specialization or isolation is worth the coordination cost. Give it a bounded goal and require file, command, log, or screenshot evidence.

Agent selection lives in `docs/agent-catalog.md`; model defaults and escalation rules live in `docs/model-routing.md`. Preserve the checked-in model and use the lowest reasoning effort that meets the verifier.

Repo-local skills live in `.agents/skills/`. Load a skill when its description matches the task, and read conditional references only when their stated trigger applies. Add a skill only for repeated, stable work with a clear boundary.

Load `browser-integration` before browser work; it routes Paseo-first, explicit Chrome, then the Codex browser. For other orchestration, use Paseo only for an advisor, committee, handoff, or bounded loop; see `docs/agent-workflows.md`.

## Quality Bar

- Findings must be grounded in files, commands, logs, tests, docs, or clearly marked inference.
- Narrow changes need targeted checks; shared behavior needs broader validation.
- Documentation should retain decisions and gotchas future agents need, without duplicating discoverable catalogs.
