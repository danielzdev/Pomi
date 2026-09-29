#!/bin/bash
# Quick check: unit tests, type check and web build.
cd "$(dirname "$0")/.." || exit 1
set -o pipefail
npm test --silent 2>&1 | tail -25 && npm run build --silent 2>&1 | tail -15
