# Source Curation

This project carries a small local operating kit for development work, but it intentionally does not copy upstream repositories wholesale.

## Import Rules

- Import principles before files.
- Prefer small repo-local instructions over global setup.
- Avoid duplicate roles with different names.
- Add a skill only when the workflow is repeated and stable.
- Add a subagent only when specialization changes the quality or safety of work.
- Do not vendor large catalogs, installers, generated assets, telemetry, or framework-specific stacks.

## Current Source Decisions

- Codex official docs define the local shape: `AGENTS.md`, `.codex/config.toml`, `.codex/agents/*.toml`, and `.agents/skills/*/SKILL.md`.
- Codex official model and subagent docs define the GPT-5.6 Sol/Terra/Luna routing recorded in `docs/model-routing.md`. Research verified 2026-08-26.
- Paseo informs the orchestration playbook: advisor, committee, handoff, loop, workspaces, and repo-local skills. Research snapshot: `getpaseo/paseo` commit `62d9e656d749`.
- awesome-codex-subagents informs the Codex TOML agent format and broad specialist coverage. Research snapshot: `VoltAgent/awesome-codex-subagents` commit `797d73698aa3`.
- awesome-agent-skills informs the skill-catalog mindset and trigger-first packaging. Research snapshot: `VoltAgent/awesome-agent-skills` commit `0e6e58985eb7`.
- Superpowers informs brainstorming, plans, TDD, systematic debugging, code review, branch finish, subagent use, worktrees, and verification discipline. Research snapshot: `obra/superpowers` commit `6fd450765978`.
- ECC informs repo-local skills, prompt-defense posture, selective install philosophy, review agents, and avoiding layered global installs. Research snapshot: `affaan-m/ECC` commit `5b173d2e6c11`.
- agency-agents informs the expanded specialist vocabulary, minimal-change discipline, product/design/security/testing lanes, and evidence-based QA posture. Research snapshot: `msitarzewski/agency-agents` commit `a077c9ac0be3`.
- last30days informs the recent-research workflow and current-community-signal posture, but its engine, scripts, provider config, and cache checks are not vendored. Research snapshot: `mvanhorn/last30days-skill` commit `122158415ae4`.
- pm-skills informs PRD writing, feature-request triage, release notes, product discovery, strategy, and PM execution workflows. Research snapshot: `phuryn/pm-skills` commit `d384f0c9eb81`.
- taste-skill informs frontend quality guidance. The repo includes a compact general-purpose `frontend-taste` skill and a focused `design-taste-frontend` adaptation for landing pages, portfolios, and redesigns, sourced from `Leonxlnx/taste-skill` at commit `5436c5952cc88d18a034d496988680a8c28a836a` under MIT license.
- stitch-skills informs source-first design-system extraction, semantic `DESIGN.md` contracts, structured UI briefs, real navigation/data boundaries, and bounded visual build loops. This repo adapts those tool-agnostic patterns without installing Stitch plugins, MCP configuration, credentials, upload scripts, or framework-specific generators. Research snapshot: `google-labs-code/stitch-skills` commit `0337446dadde6f8c94210444e2aa9d546126480f`, Apache-2.0.

## Imported Capabilities

The repo now carries a curated middleweight profile:

- 22 Codex subagents in `.codex/agents/`.
- 27 repo-local skills in `.agents/skills/`.
- An activation matrix in `docs/agent-catalog.md`.
- No upstream scripts, generated installers, global config, provider credentials, package manager dependencies, or telemetry.

## License Notes

The sampled source repositories are mostly MIT-licensed. Paseo has its own copyright license text, while `google-labs-code/stitch-skills` is Apache-2.0. This repo adapts workflows and role boundaries rather than vendoring upstream code.

When copying upstream text verbatim in the future, include the upstream license and commit in the copied file or in this document. Prefer concise repo-local adaptations unless exact upstream wording is required.

## When to Add More

Add new material only when all are true:

1. The same need appears in multiple projects or tasks.
2. Existing instructions do not cover it cleanly.
3. The new file has a clear trigger and boundary.
4. It does not require global machine state.
5. It can be verified with a simple repo-local check.

If the addition is domain-specific, keep it in that project rather than this skeleton.
