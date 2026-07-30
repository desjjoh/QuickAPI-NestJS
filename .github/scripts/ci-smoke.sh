#!/usr/bin/env bash
set -Eeuo pipefail

cd "$(dirname "$0")/../.."
compose=(docker compose --project-name quickapi-smoke --file .github/compose.ci-smoke.yml)
artifact_dir="${MIGRATION_ARTIFACT_DIR:-migration-artifacts}"
mkdir -p "$artifact_dir"
staging_env_created=false
export SMOKE_IMAGE
SMOKE_IMAGE="$(docker image inspect --format '{{.Id}}' quickapi-nestjs:ci)"
runtime_user="$(docker image inspect --format '{{.Config.User}}' "$SMOKE_IMAGE")"
[[ -n "$runtime_user" && "$runtime_user" != root && "$runtime_user" != 0 ]] || {
  echo "production image must configure a non-root runtime user" >&2
  exit 1
}

cleanup() {
  "${compose[@]}" down --volumes --remove-orphans >/dev/null 2>&1 || true
  if [[ "$staging_env_created" == true ]]; then
    rm -f .env.staging
  fi
}
capture() {
  mkdir -p smoke-logs
  for service in api migration redis mysql geoip-init preflight; do
    "${compose[@]}" logs --no-color "$service" >"smoke-logs/$service.log" 2>&1 || true
  done
}
trap 'status=$?; if (( status != 0 )); then capture; fi; cleanup; exit "$status"' EXIT

run_one_shot() {
  local service=$1
  echo "::group::Smoke: $service"
  # Keep the stopped container until cleanup so its stdout/stderr is available
  # to the failure artifact collector.
  "${compose[@]}" up --no-deps --abort-on-container-exit --exit-code-from "$service" "$service"
  echo "::endgroup::"
}

image_migration_names() {
  docker run --rm --entrypoint sh "$SMOKE_IMAGE" -c \
    "find /app/dist/database/migrations -maxdepth 1 -type f -name '*-migration.js' -exec basename {} .js \; | sort"
}

source_migration_names() {
  find src/database/migrations -maxdepth 1 -type f -name '*-migration.ts' \
    -printf '%f\n' | sed 's/\.ts$//' | sort
}

run_migration_cli() {
  "${compose[@]}" run --rm --no-deps migration "$@"
}

# Every run starts with new anonymous database state and a newly-created GeoLite volume.
cleanup
echo "::group::Smoke: ephemeral dependencies"
"${compose[@]}" up -d --wait mysql redis
echo "::endgroup::"
run_one_shot preflight
run_one_shot geoip-init

# Validate exactly what the production image can discover. This catches both a
# missing compiled migrations directory and stale/extra files in that image.
source_migration_names >"$artifact_dir/source-migrations.txt"
image_migration_names >"$artifact_dir/compiled-migrations.txt"
[[ -s "$artifact_dir/compiled-migrations.txt" || ! -s "$artifact_dir/source-migrations.txt" ]] || {
  echo 'production image contains zero migrations while source migrations exist' >&2
  exit 1
}
diff -u "$artifact_dir/source-migrations.txt" "$artifact_dir/compiled-migrations.txt"
expected_count="$(wc -l <"$artifact_dir/source-migrations.txt" | tr -d ' ')"

echo "::group::Smoke: list pending compiled migrations"
run_migration_cli node ./node_modules/typeorm/cli.js migration:show -d dist/database/typeorm.datasource.js \
  | tee "$artifact_dir/pending-before.txt"
echo "::endgroup::"
run_one_shot migration

# Read release evidence from the same database using only production-image
# dependencies. TypeORM stores class names here, which are the useful release
# audit identifiers rather than implementation filenames.
run_migration_cli node -e '
  const mysql=require("mysql2/promise");
  (async()=>{const db=await mysql.createConnection({host:process.env.DB_HOST,port:+process.env.DB_PORT,user:process.env.DB_USER,password:process.env.DB_PASSWORD,database:process.env.DB_DATABASE});const [rows]=await db.query("SELECT name FROM typeorm_migrations ORDER BY id");for(const row of rows)console.log(row.name);await db.end()})().catch(e=>{console.error(e);process.exit(1)})
' | tee "$artifact_dir/applied-migrations.txt"
actual_count="$(wc -l <"$artifact_dir/applied-migrations.txt" | tr -d ' ')"
[[ "$actual_count" == "$expected_count" ]] || {
  echo "applied $actual_count migrations; expected $expected_count" >&2
  exit 1
}
echo "::group::Smoke: API probes"
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

echo "::group::Smoke: compiled migration revert / forward"
run_migration_cli node ./node_modules/typeorm/cli.js migration:revert -d dist/database/typeorm.datasource.js
run_migration_cli node ./node_modules/typeorm/cli.js migration:show -d dist/database/typeorm.datasource.js \
  | tee "$artifact_dir/pending-after-revert.txt"
[[ "$(grep -c '^\[ \]' "$artifact_dir/pending-after-revert.txt" || true)" == 1 ]] || {
  echo 'expected exactly one pending migration after revert' >&2
  exit 1
}
run_migration_cli npm run migration:run:prod
run_migration_cli node ./node_modules/typeorm/cli.js migration:show -d dist/database/typeorm.datasource.js \
  | tee "$artifact_dir/pending-after-reapply.txt"
[[ "$(grep -c '^\[ \]' "$artifact_dir/pending-after-reapply.txt" || true)" == 0 ]] || {
  echo 'migrations remain pending after reapply' >&2
  exit 1
}
echo "::endgroup::"

# A failed one-shot migration must preserve its non-zero status. The staging
# topology's service_completed_successfully dependency then blocks a new API
# container/replacement from starting.
if "${compose[@]}" run --rm --no-deps -e DB_PASSWORD=deliberately-wrong migration; then
  echo 'migration service unexpectedly succeeded with invalid credentials' >&2
  exit 1
fi
# Staging deliberately references an uncommitted .env.staging file. Supply the
# inert smoke environment only for Compose model validation on clean CI checkouts.
if [[ ! -e .env.staging ]]; then
  cp .github/ci-smoke.env .env.staging
  staging_env_created=true
fi
export QUICKAPI_IMAGE="$SMOKE_IMAGE"
docker compose -f docker-compose.staging.yml config --format json \
  >"$artifact_dir/staging-compose.json"
node - "$artifact_dir/staging-compose.json" <<'NODE'
const fs = require('fs');

const model = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
for (const [name, service] of Object.entries(model.services)) {
  if (Object.hasOwn(service, 'build')) {
    throw new Error(`staging service ${name} contains a build property`);
  }
}

for (const name of ['preflight', 'migration', 'geoip-init', 'api']) {
  if (model.services[name]?.image !== process.env.QUICKAPI_IMAGE) {
    throw new Error(
      `staging service ${name} image ${JSON.stringify(model.services[name]?.image)} ` +
        `does not match QUICKAPI_IMAGE ${JSON.stringify(process.env.QUICKAPI_IMAGE)}`,
    );
  }
}
NODE
staging_api_condition="$(node -e 'const model=JSON.parse(require("fs").readFileSync(process.argv[1],"utf8"));process.stdout.write(model.services.api.depends_on.migration.condition)' "$artifact_dir/staging-compose.json")"
[[ "$staging_api_condition" == service_completed_successfully ]] || {
  echo 'staging API is not blocked by migration failure' >&2
  exit 1
}

api_id="$("${compose[@]}" ps --quiet api)"
docker kill --signal TERM "$api_id" >/dev/null
timeout 25 sh -c 'while docker inspect --format="{{.State.Running}}" "$1" 2>/dev/null | grep -q true; do sleep 1; done' _ "$api_id"
[[ "$(docker inspect --format '{{.State.ExitCode}}' "$api_id")" == 0 ]]
echo "::endgroup::"