# Agent Catalog

This catalog explains when to use each repo-local Codex subagent and skill. Keep activation explicit and scoped.

## Selection Rules

1. Start with the main Codex agent unless specialization will reduce risk.
2. Use `context_manager` before delegation on unfamiliar repo surfaces.
3. Use implementation agents only after the affected path is known.
4. Use review agents after a diff exists, or before a risky design ships.
5. Use Paseo for advisor, committee, handoff, or loop workflows, not as a replacement for repo-local verification.
6. Preserve the default model in `docs/model-routing.md` unless task ambiguity, risk, volume, or verifier quality justifies an override.

## Codex Agents

| Agent | Lane | Use When | Avoid When |
| --- | --- | --- | --- |
| `context_manager` | Context | A task needs a compact repo packet before implementation or delegation | You already have the relevant files and constraints |
| `architect` | Design | Boundaries, data flow, migration, or cross-module decisions matter | The task is a narrow fix with an obvious local change |
| `minimal_change_engineer` | Restraint | Scope creep or overengineering is the main risk | The task explicitly asks for broad redesign or refactor |
| `backend_developer` | Build | API, service, worker, auth, or persistence behavior changes | The owning backend path is unknown |
| `frontend_developer` | Build | UI, state, route, component, or user flow implementation | The request is only review or visual QA |
| `devops_engineer` | Ops | CI, deployment, release, env config, or build reproducibility changes | The issue is application logic only |
| `technical_writer` | Docs | README, API docs, runbooks, migration guides, or release docs | Facts cannot be verified from repo or provided sources |
| `reviewer` | Review | General diff review for correctness, regressions, and tests | A narrower specialist review is sufficient alone |
| `typescript_reviewer` | Review | TS/JS changes need type, async, runtime, or module-boundary review | No TS/JS behavior changed |
| `react_reviewer` | Review | React, JSX, TSX, hooks, RSC, or accessibility risks changed | The change is pure server-side TS |
| `security_auditor` | Review | Auth, secrets, input handling, dependencies, infra, or exposure changed | There is no trust boundary impact |
| `database_reviewer` | Review | SQL, migrations, schema, RLS, indexes, or locking changed | No data-store behavior changed |
| `dependency_reviewer` | Review | Packages, plugins, external tools, licenses, or lockfiles changed | The dependency is already established and untouched |
| `accessibility_tester` | Review | Web UI needs keyboard, semantics, labels, focus, or WCAG checks | The change is non-UI |
| `test_automator` | Verification | A behavior change needs focused regression tests | No test harness or meaningful assertion exists |
| `evidence_collector` | Verification | Claims need screenshots, logs, command output, or reproduction proof | Evidence is already captured and current |
| `debugger` | Analysis | Failing tests, runtime errors, flakes, or regressions need root cause | There is no concrete symptom |
| `docs_researcher` | Research | API/version/tool behavior must be verified from official docs | Local repo evidence is enough |
| `performance_optimizer` | Analysis | Latency, memory, bundle, Core Web Vitals, or query performance matters | There is no performance target or symptom |
| `product_manager` | Product | Scope, prioritization, PRD, acceptance criteria, or roadmap tradeoffs matter | The request is an implementation detail only |
| `ux_researcher` | Product | User journeys, personas, usability risk, or research synthesis matter | No user behavior decision is involved |
| `eval_engineer` | AI Quality | Prompts, retrieval, tool use, or agent workflows need eval criteria | A normal unit/integration test is enough |

## Skill Groups

| Group | Skills | Purpose |
| --- | --- | --- |
| Discovery and planning | `repo-discovery`, `brainstorming`, `planning-contract`, `writing-plans` | Understand the repo, clarify intent, and produce executable plans |
| Browser integration | `browser-integration` | Bootstrap the in-app browser through the supported direct runtime and recover without speculative fallbacks |
| Orchestration | `subagent-driven-development`, `using-git-worktrees` | Use agents and isolated workspaces intentionally |
| Build discipline | `tdd-workflow`, `systematic-debugging`, `verification-loop`, `branch-finish` | Keep implementation evidence-led and finish cleanly |
| Review and risk | `code-review`, `security-review`, `dependency-review`, `performance-audit`, `accessibility-audit`, `evidence-qa` | Find defects and prove claims |
| Product and docs | `prd-writing`, `feature-request-triage`, `release-notes`, `technical-writing`, `recent-research` | Shape requirements, research current facts, and document outcomes |
| AI systems | `eval-design` | Define scenario coverage, rubrics, and regression gates |
| Operations | `incident-response` | Stabilize incidents, preserve evidence, and verify recovery |
| Frontend systems | `design-system-extraction`, `frontend-taste`, `design-taste-frontend` | Extract visual contracts, improve UI quality, and preserve responsive art direction |

## Recommended Combinations

| Scenario | Agents | Skills |
| --- | --- | --- |
| New unfamiliar repo task | `context_manager` | `repo-discovery`, `planning-contract` |
| Narrow bug fix | `minimal_change_engineer`, `debugger`, `test_automator` | `systematic-debugging`, `tdd-workflow`, `verification-loop` |
| React feature | `frontend_developer`, `react_reviewer`, `typescript_reviewer`, `accessibility_tester` | `design-system-extraction` when the visual contract is unclear, then `frontend-taste`, `accessibility-audit`, `verification-loop` |
| Backend feature | `backend_developer`, `security_auditor`, `database_reviewer`, `test_automator` | `tdd-workflow`, `security-review`, `verification-loop` |
| CI or release failure | `devops_engineer`, `evidence_collector` | `incident-response`, `verification-loop`, `branch-finish` |
| Product discovery | `product_manager`, `ux_researcher`, `docs_researcher` | `brainstorming`, `feature-request-triage`, `recent-research`, `prd-writing` |
| AI agent workflow | `eval_engineer`, `docs_researcher`, `reviewer` | `eval-design`, `subagent-driven-development`, `evidence-qa` |
| Performance issue | `performance_optimizer`, `database_reviewer`, `frontend_developer` as needed | `performance-audit`, `evidence-qa` |
| Local UI or browser flow | `frontend_developer`, `evidence_collector` as needed | `browser-integration`, `accessibility-audit`, `verification-loop` |

## Source Lineage

This catalog is curated from the source repositories listed in `docs/source-curation.md`. It intentionally adapts role boundaries and workflows into concise Codex/Paseo repo-local files instead of vendoring full upstream catalogs.
