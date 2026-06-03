#!/usr/bin/env bash
set -euo pipefail

DEST="${1:-$HOME/.agents/skills}"
SKILLS=(sleuth sleuth-scan sleuth-test sleuth-security sleuth-retest)

echo "Uninstalling Sleuth skills from $DEST ..."
for name in "${SKILLS[@]}"; do
  target="$DEST/$name"
  if [ -d "$target" ]; then
    rm -rf "$target"
    echo "removed $target"
  else
    echo "skipped $target (not found)"
  fi
done

echo ""
echo "Done. Sleuth skills removed from $DEST"
