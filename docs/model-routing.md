# GPT-5.6 Model Routing

This repository assigns explicit models to custom Codex agents so copied projects have predictable defaults. The routing follows current OpenAI guidance as verified on 2026-08-26.

## Official model roles

- `gpt-5.6-sol`: flagship model for complex, ambiguous, high-value work that benefits from deeper judgment and polish.
- `gpt-5.6-terra`: balanced everyday model for strong reasoning and tool use, including exploration, read-heavy scans, and supporting parallel work.
- `gpt-5.6-luna`: fast, low-cost model for clear, narrow, repeatable, or high-volume tasks with an explicit definition of done.

All three API model pages list `none`, `low`, `medium`, `high`, `xhigh`, and `max` reasoning efforts, with `medium` as the default. This starter keeps `low`, `medium`, and `high` in custom agents because those levels cover its roles without making maximum-effort execution a standing default.

## Repo assignment

| Model | Agents | Why |
| --- | --- | --- |
| `gpt-5.6-sol` | `architect`, `database_reviewer`, `debugger`, `reviewer`, `security_auditor` | These roles handle ambiguous cross-cutting decisions or high-impact correctness and security analysis. |
| `gpt-5.6-terra` | `accessibility_tester`, `backend_developer`, `context_manager`, `dependency_reviewer`, `devops_engineer`, `docs_researcher`, `eval_engineer`, `frontend_developer`, `performance_optimizer`, `product_manager`, `react_reviewer`, `technical_writer`, `typescript_reviewer`, `ux_researcher` | These are bounded specialist tasks that still require dependable reasoning, tool use, or synthesis. |
| `gpt-5.6-luna` | `evidence_collector`, `minimal_change_engineer`, `test_automator` | These roles are deliberately narrow, repeatable, and governed by concrete evidence or acceptance criteria. |

Reasoning effort remains role-specific. Start from the configured level and raise it only when task complexity or failed verification justifies the added latency and usage.

## Selection rules

1. Prefer the agent's checked-in model for normal use.
2. Escalate a Terra or Luna task to Sol when the scope becomes ambiguous, cross-cutting, security-sensitive, or difficult to verify.
3. Move work toward Luna only when the prompt has a narrow scope, deterministic inputs, and a concrete output contract.
4. Do not use model count as a reason to delegate. First decide whether specialization or parallelism improves the outcome.
5. Recheck official documentation before changing model IDs, reasoning levels, or retirement guidance.

## Official sources

- [Codex models and Sol/Terra/Luna selection](https://learn.chatgpt.com/docs/models#recommended-models)
- [Codex subagent model and reasoning guidance](https://learn.chatgpt.com/docs/agent-configuration/subagents#choosing-models-and-reasoning)
- [GPT-5.6 Sol API model page](https://developers.openai.com/api/docs/models/gpt-5.6-sol)
- [GPT-5.6 Terra API model page](https://developers.openai.com/api/docs/models/gpt-5.6-terra)
- [GPT-5.6 Luna API model page](https://developers.openai.com/api/docs/models/gpt-5.6-luna)

The Codex model page also says GPT-5.4 and GPT-5.4 mini retire from Codex with ChatGPT sign-in on 2026-08-31 and recommends replacing them with Terra and Luna respectively. API-key-authenticated Codex and the OpenAI API are not affected by that retirement.
