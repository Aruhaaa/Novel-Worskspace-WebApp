#!/usr/bin/env bash
# Regenerate the nine frames, then assemble the root and stamp the transitions.
# Run from the project root: bash capture-scripts/rebuild.sh
set -e
S="C:/Users/USER/.claude/skills/product-launch-video/scripts"
node capture-scripts/gen-frames.mjs
node "$S/assemble-index.mjs" --storyboard ./STORYBOARD.md --hyperframes .
node "$S/transitions.mjs" inject --storyboard ./STORYBOARD.md --hyperframes .
node "$S/transitions.mjs" verify --storyboard ./STORYBOARD.md --index ./index.html
