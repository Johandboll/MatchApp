#!/usr/bin/env bash
set -euo pipefail

if [ ! -f .env.test.local ]; then
  echo "Missing .env.test.local"
  echo "Create it from .env.test.local.example and add the Supabase test URL/key."
  exit 1
fi

set -a
# shellcheck disable=SC1091
. ./.env.test.local
set +a

if [ -z "${REACT_APP_SUPABASE_URL:-}" ] || [ -z "${REACT_APP_SUPABASE_ANON_KEY:-}" ]; then
  echo "Missing REACT_APP_SUPABASE_URL or REACT_APP_SUPABASE_ANON_KEY in .env.test.local"
  exit 1
fi

if [ "${REACT_APP_SUPABASE_ANON_KEY}" = "PASTE_TEST_ANON_KEY_HERE" ]; then
  echo "Replace PASTE_TEST_ANON_KEY_HERE in .env.test.local with the Supabase test anon key."
  exit 1
fi

export REACT_APP_APP_VERSION="${npm_package_version}-test"
node scripts/write-version.js
PUBLIC_URL=/test REACT_APP_BUILD_TIME=$(node -p "require('./public/version.json').buildTime") react-scripts build
