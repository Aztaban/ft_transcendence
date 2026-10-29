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
  # The built frontend comes from nginx, and app routes fall back to index.html.
  grep -q 'id="root"' <<< "$(curl -fsk "$BASE/")"
  grep -q 'id="root"' <<< "$(curl -fsk "$BASE/requests")"
  # So do Django's static files (collectstatic).
  curl -fsk -o /dev/null "$BASE/static/admin/css/base.css"
  # DEBUG is off: an unknown admin page is a plain 404, not Django's technical page.
  page=$(curl -sk "$BASE/admin/no-such-page/")
  if grep -q "URLconf" <<< "$page"; then echo "DEBUG is on"; exit 1; fi
fi
echo "smoke test passed${1:+ ($1)}"
