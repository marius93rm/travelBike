#!/usr/bin/env python3
"""Repo-local integrity checks for BikeTrain România.

The goal is not to prove every sentence in the docs. The goal is to catch
high-signal drift between the canonical files:

- .codex/agents/*.toml
- .agents/skills/*/SKILL.md
- AGENTS.md
- README.md
- docs/agent-catalog.md
- .gitignore

It also keeps always-loaded instructions and skill discovery metadata within
repo-defined context budgets.
"""

from __future__ import annotations

import argparse
import re
import sys
from dataclasses import dataclass
from html.parser import HTMLParser
from pathlib import Path
from typing import Iterable
from urllib.parse import unquote, urlparse

ROOT = Path(__file__).resolve().parents[1]
REPO_BLOB_PREFIX = "/marius93rm/unaSquadraFortissimi/blob/main/"

AGENT_REQUIRED_FIELDS = {
    "name",
    "description",
    "model",
    "model_reasoning_effort",
    "sandbox_mode",
    "developer_instructions",
}

ALLOWED_REASONING = {"low", "medium", "high"}
ALLOWED_SANDBOX = {"read-only", "workspace-write"}
ALLOWED_MODELS = {"gpt-5.6-sol", "gpt-5.6-terra", "gpt-5.6-luna"}
MODEL_DISPLAY_ORDER = ("gpt-5.6-sol", "gpt-5.6-terra", "gpt-5.6-luna")
AGENTS_MD_BUDGET_BYTES = 3_200
SKILL_CATALOG_BUDGET_CHARS = 6_500
BROWSER_SKILL_BUDGET_BYTES = 4_000
BROWSER_SKILL_MARKERS = {
    'Do not switch browser lanes automatically',
    'Default Permissions',
    'mcp__paseo__browser_list_tabs',
    'mcp__paseo__browser_snapshot',
    'mcp__node_repl__js',
    'scripts/browser-client.mjs',
    'agent.browsers.list()',
    'agent.browsers.get(chromeInfo.id)',
    'agent.browsers.get("iab")',
    'info.type === "extension"',
    'browser.tabs.selected()',
    'browser.tabs.new()',
}
BROWSER_RECOVERY_MARKERS = {
    'No Paseo browser host',
    'Tools enabled after agent start',
    'Chrome client absent',
}
BROWSER_CROSS_HOST_FALLBACK_PHRASES = {
    'Do not stop while another supported backend is available',
    'try the next supported branch',
    'move to the next supported backend',
}
AGENT_UPLINK_MARKERS = {
    'id="uplink"',
    'data-copy-uplink',
    'id="agent-bootstrap"',
    'USF_AGENT_UPLINK',
    'merge, mai overwrite',
    'nessuna esecuzione automatica',
}


@dataclass(frozen=True)
class CheckResult:
    path: str
    message: str


class LocalHtmlParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.ids: set[str] = set()
        self.links: list[tuple[str, str]] = []
        self.images: list[tuple[str, str]] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        attr_map = {key: value or "" for key, value in attrs}
        if "id" in attr_map:
            self.ids.add(attr_map["id"])
        if "href" in attr_map:
            self.links.append((tag, attr_map["href"]))
        if "src" in attr_map:
            self.links.append((tag, attr_map["src"]))
        if tag == "img":
            self.images.append((attr_map.get("src", ""), attr_map.get("alt", "")))


def read_text(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def rel(path: Path) -> str:
    return path.relative_to(ROOT).as_posix()


def fail(failures: list[CheckResult], path: str | Path, message: str) -> None:
    failures.append(CheckResult(rel(path) if isinstance(path, Path) else path, message))


def parse_simple_toml(text: str) -> dict[str, str]:
    """Parse the simple top-level string assignments used by agent TOML files."""
    data: dict[str, str] = {}
    lines = text.splitlines()
    index = 0

    while index < len(lines):
        line = lines[index].strip()
        index += 1

        if not line or line.startswith("#") or "=" not in line:
            continue

        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip()

        if value.startswith('"""'):
            collected: list[str] = []
            value = value[3:]
            if value.endswith('"""'):
                data[key] = value[:-3]
                continue
            collected.append(value)
            while index < len(lines):
                current = lines[index]
                index += 1
                if current.rstrip().endswith('"""'):
                    collected.append(current.rstrip()[:-3])
                    break
                collected.append(current)
            data[key] = "\n".join(collected).strip()
            continue

        match = re.fullmatch(r'"(.*)"', value)
        if match:
            data[key] = match.group(1)

    return data


def parse_skill_frontmatter(text: str) -> dict[str, str]:
    lines = text.splitlines()
    if not lines or lines[0].strip() != "---":
        return {}

    frontmatter: dict[str, str] = {}
    for line in lines[1:]:
        if line.strip() == "---":
            break
        if ":" not in line:
            continue
        key, value = line.split(":", 1)
        frontmatter[key.strip()] = value.strip()

    return frontmatter


def find_agent_files() -> list[Path]:
    return sorted((ROOT / ".codex" / "agents").glob("*.toml"))


def find_skill_files() -> list[Path]:
    return sorted((ROOT / ".agents" / "skills").glob("*/SKILL.md"))


def assert_text_mentions_all(
    failures: list[CheckResult],
    doc_path: Path,
    names: Iterable[str],
    label: str,
) -> None:
    text = read_text(doc_path)
    for name in names:
        if f"`{name}`" not in text and name not in text:
            fail(failures, doc_path, f"missing {label} reference: {name}")


def check_agents(failures: list[CheckResult]) -> list[str]:
    agent_files = find_agent_files()
    agent_names: list[str] = []

    if not agent_files:
        fail(failures, ".codex/agents", "no agent TOML files found")
        return agent_names

    for path in agent_files:
        data = parse_simple_toml(read_text(path))
        missing = sorted(AGENT_REQUIRED_FIELDS - data.keys())
        if missing:
            fail(failures, path, f"missing required fields: {', '.join(missing)}")
            continue

        expected_name = path.stem
        actual_name = data["name"]
        agent_names.append(actual_name)

        if actual_name != expected_name:
            fail(failures, path, f"name must match filename stem: expected {expected_name}, got {actual_name}")
        if data["model_reasoning_effort"] not in ALLOWED_REASONING:
            fail(failures, path, f"invalid model_reasoning_effort: {data['model_reasoning_effort']}")
        if data["sandbox_mode"] not in ALLOWED_SANDBOX:
            fail(failures, path, f"invalid sandbox_mode: {data['sandbox_mode']}")
        if data["model"] not in ALLOWED_MODELS:
            fail(failures, path, f"model should follow the repo GPT-5.6 routing, got {data['model']}")
        if len(data["developer_instructions"].split()) < 20:
            fail(failures, path, "developer_instructions look too short to guide the agent")

    return sorted(agent_names)


def check_skills(failures: list[CheckResult]) -> list[str]:
    skill_files = find_skill_files()
    skill_names: list[str] = []

    if not skill_files:
        fail(failures, ".agents/skills", "no SKILL.md files found")
        return skill_names

    for path in skill_files:
        frontmatter = parse_skill_frontmatter(read_text(path))
        expected_name = path.parent.name
        actual_name = frontmatter.get("name")

        if not actual_name:
            fail(failures, path, "missing frontmatter name")
            continue

        skill_names.append(actual_name)

        if actual_name != expected_name:
            fail(failures, path, f"name must match directory: expected {expected_name}, got {actual_name}")
        if not frontmatter.get("description"):
            fail(failures, path, "missing frontmatter description")

        if actual_name == "browser-integration":
            text = read_text(path)
            missing_markers = sorted(marker for marker in BROWSER_SKILL_MARKERS if marker not in text)
            if missing_markers:
                fail(failures, path, f"missing browser integration markers: {', '.join(missing_markers)}")
            size = len(text.encode("utf-8"))
            if size > BROWSER_SKILL_BUDGET_BYTES:
                fail(
                    failures,
                    path,
                    f"browser skill exceeds normal-path budget: {size} > {BROWSER_SKILL_BUDGET_BYTES} bytes",
                )
            recovery_path = path.parent / "references" / "recovery.md"
            if "references/recovery.md" not in text or not recovery_path.exists():
                fail(failures, path, "browser recovery reference is missing or not linked")
            else:
                recovery_text = read_text(recovery_path)
                missing_recovery = sorted(
                    marker for marker in BROWSER_RECOVERY_MARKERS if marker not in recovery_text
                )
                if missing_recovery:
                    fail(
                        failures,
                        recovery_path,
                        f"missing browser recovery markers: {', '.join(missing_recovery)}",
                    )
                combined_browser_contract = f"{text}\n{recovery_text}"
                for phrase in sorted(BROWSER_CROSS_HOST_FALLBACK_PHRASES):
                    if phrase in combined_browser_contract:
                        fail(failures, path, f"cross-host fallback claim is forbidden: {phrase}")

    return sorted(skill_names)


def check_docs(failures: list[CheckResult], agent_names: list[str], skill_names: list[str]) -> None:
    agents_md = ROOT / "AGENTS.md"
    readme = ROOT / "README.md"
    catalog = ROOT / "docs" / "agent-catalog.md"
    model_routing = ROOT / "docs" / "model-routing.md"

    for path in [agents_md, readme, catalog, model_routing]:
        if not path.exists():
            fail(failures, path, "required documentation file is missing")
            return

    assert_text_mentions_all(failures, catalog, agent_names, "agent")
    assert_text_mentions_all(failures, model_routing, agent_names, "agent")

    for model in sorted(ALLOWED_MODELS):
        if f"`{model}`" not in read_text(model_routing):
            fail(failures, model_routing, f"missing model routing reference: {model}")

    model_routing_text = read_text(model_routing)
    for agent_path in find_agent_files():
        data = parse_simple_toml(read_text(agent_path))
        model = data.get("model", "")
        name = data.get("name", agent_path.stem)
        row_pattern = rf"\| `{re.escape(model)}` \| [^\n]*`{re.escape(name)}`"
        if not re.search(row_pattern, model_routing_text):
            fail(failures, model_routing, f"agent routing does not match TOML: {name} -> {model}")

    assert_text_mentions_all(failures, catalog, skill_names, "skill")

    agents_size = len(read_text(agents_md).encode("utf-8"))
    if agents_size > AGENTS_MD_BUDGET_BYTES:
        fail(
            failures,
            agents_md,
            f"always-loaded instructions exceed context budget: {agents_size} > {AGENTS_MD_BUDGET_BYTES} bytes",
        )

    agents_text = read_text(agents_md)
    for required_reference in ["docs/agent-catalog.md", "docs/model-routing.md"]:
        if required_reference not in agents_text:
            fail(failures, agents_md, f"missing canonical catalog reference: {required_reference}")

    skill_catalog_chars = 0
    for skill_path in find_skill_files():
        frontmatter = parse_skill_frontmatter(read_text(skill_path))
        skill_catalog_chars += len(rel(skill_path))
        skill_catalog_chars += len(frontmatter.get("name", ""))
        skill_catalog_chars += len(frontmatter.get("description", ""))
    if skill_catalog_chars > SKILL_CATALOG_BUDGET_CHARS:
        fail(
            failures,
            ".agents/skills",
            (
                "initial skill catalog metadata exceeds context budget: "
                f"{skill_catalog_chars} > {SKILL_CATALOG_BUDGET_CHARS} characters"
            ),
        )

    readme_text = read_text(readme)
    if not readme_text.startswith("# BikeTrain România\n"):
        fail(failures, readme, "README should start with the current product title")

def is_external_reference(value: str) -> bool:
    if not value:
        return True
    parsed = urlparse(value)
    return parsed.scheme in {"http", "https", "mailto", "tel", "data"} and REPO_BLOB_PREFIX not in parsed.path


def repo_blob_path(value: str) -> Path | None:
    parsed = urlparse(value)
    if parsed.scheme not in {"http", "https"}:
        return None
    if not parsed.netloc.endswith("github.com"):
        return None
    if REPO_BLOB_PREFIX not in parsed.path:
        return None
    raw_path = parsed.path.split(REPO_BLOB_PREFIX, 1)[1]
    return ROOT / unquote(raw_path)


def check_html(failures: list[CheckResult], agent_names: list[str], skill_names: list[str]) -> None:
    html_path = ROOT / "index.html"
    if not html_path.exists():
        fail(failures, html_path, "static landing page is missing")
        return

    html_text = read_text(html_path)
    assert_text_mentions_all(failures, html_path, agent_names, "agent")
    assert_text_mentions_all(failures, html_path, skill_names, "skill")

    missing_uplink_markers = sorted(marker for marker in AGENT_UPLINK_MARKERS if marker not in html_text)
    if missing_uplink_markers:
        fail(failures, html_path, f"agent uplink is incomplete: {', '.join(missing_uplink_markers)}")

    model_counts = {model: 0 for model in MODEL_DISPLAY_ORDER}
    for agent_path in find_agent_files():
        data = parse_simple_toml(read_text(agent_path))
        model = data.get("model", "")
        name = data.get("name", agent_path.stem)
        card_pattern = (
            rf"<h4>{re.escape(name)}</h4>"
            rf"(?:(?!</article>).)*?<dt>Modello</dt><dd>{re.escape(model)}</dd>"
        )
        if not re.search(card_pattern, html_text, re.DOTALL):
            fail(failures, html_path, f"agent card model does not match TOML: {name} -> {model}")
        if model in model_counts:
            model_counts[model] += 1

    expected_model_summary = " / ".join(str(model_counts[model]) for model in MODEL_DISPLAY_ORDER)
    if f"<h4>{expected_model_summary}</h4>" not in html_text:
        fail(failures, html_path, f"model count summary is stale: expected {expected_model_summary}")

    parser = LocalHtmlParser()
    parser.feed(html_text)

    for tag, value in parser.links:
        if not value or value.startswith("#"):
            if value.startswith("#") and value[1:] not in parser.ids:
                fail(failures, html_path, f"broken anchor link `{value}` in <{tag}>")
            continue

        blob_path = repo_blob_path(value)
        if blob_path is not None:
            if not blob_path.exists():
                fail(failures, html_path, f"GitHub blob link points to missing path: {rel(blob_path)}")
            continue

        if is_external_reference(value):
            continue

        local_path = ROOT / value.split("#", 1)[0]
        if not local_path.exists():
            fail(failures, html_path, f"local <{tag}> reference points to missing path: {value}")

    for src, alt in parser.images:
        if src and not alt.strip():
            fail(failures, html_path, f"image `{src}` is missing alt text")


def check_gitignore(failures: list[CheckResult]) -> None:
    gitignore = ROOT / ".gitignore"
    if not gitignore.exists():
        fail(failures, gitignore, "required repository hygiene file is missing")
        return

    patterns = {
        line.strip()
        for line in read_text(gitignore).splitlines()
        if line.strip() and not line.startswith("#")
    }
    for required in {".DS_Store", "__pycache__/", "node_modules/", ".env", ".codex/", ".agents/"}:
        if required not in patterns:
            fail(failures, gitignore, f"missing required ignore pattern: {required}")


def run_checks() -> list[CheckResult]:
    failures: list[CheckResult] = []
    agent_names = check_agents(failures)
    skill_names = check_skills(failures)
    check_docs(failures, agent_names, skill_names)
    check_gitignore(failures)
    return failures


def main() -> int:
    parser = argparse.ArgumentParser(description="Validate BikeTrain repo-local agent configuration.")
    parser.add_argument("--quiet", action="store_true", help="Only print failures.")
    args = parser.parse_args()

    failures = run_checks()

    if failures:
        print("Repo validation failed:\n")
        for item in failures:
            print(f"- {item.path}: {item.message}")
        return 1

    if not args.quiet:
        print("Repo validation passed.")
        print(f"- agents: {len(find_agent_files())}")
        print(f"- skills: {len(find_skill_files())}")
        print("- docs, context budgets, kit integrity, and .gitignore checked")

    return 0


if __name__ == "__main__":
    sys.exit(main())
