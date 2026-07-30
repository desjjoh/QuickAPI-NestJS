#!/usr/bin/env bash
set -Eeuo pipefail

cd "$(dirname "$0")/../.."
compose=(docker compose --project-name quickapi-smoke --file .github/compose.ci-smoke.yml)
export SMOKE_IMAGE
SMOKE_IMAGE="$(docker image inspect --format '{{.Id}}' quickapi-nestjs:ci)"
runtime_user="$(docker image inspect --format '{{.Config.User}}' "$SMOKE_IMAGE")"
[[ -n "$runtime_user" && "$runtime_user" != root && "$runtime_user" != 0 ]] || {
  echo "production image must configure a non-root runtime user" >&2
  exit 1
}

cleanup() { "${compose[@]}" down --volumes --remove-orphans >/dev/null 2>&1 || true; }
capture() {
  mkdir -p smoke-logs
  for service in api migration redis mysql geoip-init preflight; do
    "${compose[@]}" logs --no-color "$service" >"smoke-logs/$service.log" 2>&1 || true
  done
}
trap 'status=$?; if (( status != 0 )); then capture; fi; cleanup; exit "$status"' EXIT

# Every run starts with new anonymous database state and a newly-created GeoLite volume.
cleanup
"${compose[@]}" up -d --wait mysql redis
"${compose[@]}" run --rm preflight
"${compose[@]}" run --rm geoip-init
"${compose[@]}" run --rm migration
"${compose[@]}" up -d --no-deps api

poll_200() {
  local path=$1
  for _ in {1..60}; do
    [[ "$(curl --silent --output /dev/null --write-out '%{http_code}' "http://127.0.0.1:4000$path" || true)" == 200 ]] && return
    sleep 2
  done
  echo "$path did not return HTTP 200" >&2
  return 1
}
expect_status() {
  local expected=$1 path=$2; shift 2
  local actual
  actual="$(curl --silent --output /dev/null --write-out '%{http_code}' "$@" "http://127.0.0.1:4000$path")"
  [[ "$actual" == "$expected" ]] || { echo "$path returned $actual, expected $expected" >&2; return 1; }
}

poll_200 /health
poll_200 /ready
expect_status 200 /api/v1/library/countries
expect_status 404 /docs
expect_status 404 /docs-json
expect_status 401 /system
expect_status 401 /info
expect_status 401 /metrics --header 'X-Operations-Key: invalid-key'
expect_status 200 /metrics --header 'X-Operations-Key: ci-operations-key-not-a-production-secret'

api_id="$("${compose[@]}" ps --quiet api)"
docker kill --signal TERM "$api_id" >/dev/null
timeout 25 sh -c 'while docker inspect --format="{{.State.Running}}" "$1" 2>/dev/null | grep -q true; do sleep 1; done' _ "$api_id"
[[ "$(docker inspect --format '{{.State.ExitCode}}' "$api_id")" == 0 ]]
