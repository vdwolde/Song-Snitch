#!/bin/bash
# Claude Code cloud sessions only. Vendored into each personal project by Development-Base/Scripts/SyncToolkit.ps1;
# edit it in Development-Base, never in a project. Started by the SessionStart hook "toolkit-bootstrap".
#
# A cloud session reads this repo's .claude/ but not ~/.claude, and the skills and agents name their
# helpers as ~/.claude/skills/..., ~/.claude/agents/... and ~/.claude/tools/.... Recreate that layout in the
# VM with symlinks, so every one of those paths resolves unchanged. No network, safe to run twice.
[ "$CLAUDE_CODE_REMOTE" = "true" ] || exit 0

proj="${CLAUDE_PROJECT_DIR:-$PWD}"
home="${HOME:-/root}"
mkdir -p "$home/.claude/skills"

link() { # $1 = real folder in the project, $2 = where ~/.claude expects it; never replaces a real folder
  [ -d "$1" ] || return 0
  if [ -L "$2" ] || [ ! -e "$2" ]; then ln -sfn "$1" "$2"; fi
}

link "$proj/.claude/agents" "$home/.claude/agents"
link "$proj/.claude/tools" "$home/.claude/tools"
for d in "$proj"/.claude/skills/*/; do
  [ -f "${d}SKILL.md" ] && link "${d%/}" "$home/.claude/skills/$(basename "$d")"
done

# The rules are not handled here on purpose. The parent Development Base/CLAUDE.md is not in a cloned project, so a short
# excerpt ships as .claude/rules/dev-core-rules.md, which a cloud session loads by itself. Two ways to do it from this
# hook were tried in a real VM and failed: writing ~/.claude/CLAUDE.md (read before the hook ran) and printing the
# rules (hook output is cut to a short preview).
exit 0
