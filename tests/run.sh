#!/usr/bin/env bash
# Runs the browser tests against a local copy of the site.
#
#   tests/run.sh [output-folder]
#
# Needs Node with Playwright and Chromium (NODE_PATH should find playwright;
# by default it uses the global npm folder). Serves the site on port 8765,
# makes the files the documents test uploads, and runs every tests/*-test.js.
# Screenshots go to the output folder.
set -u
cd "$(dirname "$0")/.."
OUT="${1:-$(mktemp -d)}"
mkdir -p "$OUT/files"
head -c 2048 /dev/urandom > "$OUT/files/Insurance_certificate_2026.pdf"
echo "Volunteer handbook text" > "$OUT/files/volunteer-handbook.txt"
head -c 300000 /dev/urandom > "$OUT/files/site-map.png"
head -c 11000000 /dev/zero > "$OUT/files/too-big.pdf"

python3 -m http.server 8765 >/dev/null 2>&1 &
SERVER=$!
trap 'kill $SERVER 2>/dev/null' EXIT
sleep 1

export NODE_PATH="${NODE_PATH:-$(npm root -g)}"
fail=0
for t in tests/*-test.js; do
  out=$(timeout 300 node "$t" "$OUT" 2>&1)
  if echo "$out" | grep -qE "FAIL|Error"; then
    echo "✗ $(basename "$t")"
    echo "$out" | grep -E "FAIL|Error" -A4 | head -10 | sed 's/^/    /'
    fail=1
  else
    echo "✓ $(basename "$t")  $(echo "$out" | grep -E '^[0-9]+ ok' | head -1)"
  fi
done
echo "Screenshots: $OUT"
exit $fail
