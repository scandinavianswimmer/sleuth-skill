#!/usr/bin/env bash
set -euo pipefail

DEST="${1:-$HOME/.agents/skills}"
REPO="$(cd "$(dirname "$0")" && pwd)"

mkdir -p "$DEST"

copy_shared() {
  cp -R "$REPO/scripts" "$REPO/references" "$REPO/schemas" "$1/"
}

install_skill() {
  local skill_name="$1"
  local srcdir="$2"
  local out="$DEST/$skill_name"
  rm -rf "$out"
  mkdir -p "$out"
  cp "$srcdir/SKILL.md" "$out/"
  if [ -f "$srcdir/agents/openai.yaml" ]; then
    mkdir -p "$out/agents"
    cp "$srcdir/agents/openai.yaml" "$out/agents/"
  fi
  copy_shared "$out"
  echo "installed $skill_name -> $out"
}

install_skill sleuth "$REPO"
for d in "$REPO"/commands/*/; do
  install_skill "$(basename "$d")" "$d"
done

echo ""
echo "Done. Open Codex and run /skills — you should see: sleuth, sleuth-scan, sleuth-test, sleuth-security, sleuth-retest, sleuth-design, sleuth-fix"
