#!/usr/bin/env bash
# Checks a running stack end to end through nginx. Used by CI; also runs by hand:
#   scripts/smoke-test.sh          the development stack (`make up`)
#   scripts/smoke-test.sh prod     the production profile (`make prod`)
set -euo pipefail
BASE=${BASE:-https://localhost}

wait_for() {
  for _ in $(seq 60); do curl -fsk -o /dev/null "$1" && return 0; sleep 5; done
  echo "No answer from $1"
  return 1
}

wait_for "$BASE/health/"
health=$(curl -fsk "$BASE/health/")
echo "health: $health"
grep -q '"status": "ok"' <<< "$health"
curl -fsk -o /dev/null "$BASE/api/v1/"
wait_for "$BASE/"

if [ "${1:-}" = "prod" ]; then
  html=$(curl -fsk "$BASE/")
  if grep -q '/@vite/client' <<< "$html"; then echo "The Vite dev server answers /"; exit 1; fi
  assets=$(grep -o '/assets/[^"]*\.\(js\|css\)' <<< "$html" || true)
  if [ -z "$assets" ]; then echo "index.html links no built assets"; exit 1; fi
  
  for asset in $assets; do
    # A missing file falls back to index.html with 200, so check the type too.
    type=$(curl -fsk -o /dev/null -w '%{content_type}' "$BASE$asset")
    case $type in text/html*) echo "$asset is missing"; exit 1 ;; esac
  done

  # App routes fall back to the same index.html.
  [ "$(curl -fsk "$BASE/requests")" = "$html" ]

  # Django's static files (collectstatic).
  curl -fsk -o /dev/null "$BASE/static/admin/css/base.css"

  # DEBUG is off: a missing static file reaches Django, whose debug 404 page names the setting.
  page=$(curl -sk "$BASE/static/no-such-file.css")
  if grep -q "DEBUG = True" <<< "$page"; then echo "DEBUG is on"; exit 1; fi
fi
echo "smoke test passed${1:+ ($1)}"
