#!/usr/bin/env bash
# Install the pinned gate tools into one folder outside the repo, then print the PATH line to use.
#   bash scripts/install-gate-tools.sh [DIR]      (default: $HOME/.cache/vault-gate-tools)

# Python tools install from hash-locked ci-tools/requirements.txt. jscpd installs from ci-tools/package-lock.json (npm ci).
# The two binaries (actionlint, vale) must match the SHA-256 below, or the install stops. Linux x86_64 only.
# To bump a binary, change the version and the hash together, from the release's own checksums file.
set -euo pipefail

ACTIONLINT_VERSION=1.7.12
ACTIONLINT_SHA256=8aca8db96f1b94770f1b0d72b6dddcb1ebb8123cb3712530b08cc387b349a3d8
VALE_VERSION=3.27.0
VALE_SHA256=c80d62f6bce87b81843ac5b512a26e63213927b957adba0a64fc594570da2000

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DIR="${1:-$HOME/.cache/vault-gate-tools}"
mkdir -p "$DIR/bin" "$DIR/dl"

fetch_binary() { # name url sha256 archive-member
  local name="$1" url="$2" sha="$3" member="$4" file="$DIR/dl/$1.tar.gz"
  curl -fsSL "$url" -o "$file"
  echo "$sha  $file" | sha256sum -c - >/dev/null || { echo "install-gate-tools: checksum mismatch for $name" >&2; exit 1; }
  tar -xzf "$file" -C "$DIR/bin" "$member"
}

python3 -m venv "$DIR/venv"
"$DIR/venv/bin/pip" install -q --disable-pip-version-check --require-hashes -r "$ROOT/ci-tools/requirements.txt"
(cd "$ROOT/ci-tools" && npm ci --ignore-scripts --no-audit --no-fund)
fetch_binary actionlint \
  "https://github.com/rhysd/actionlint/releases/download/v${ACTIONLINT_VERSION}/actionlint_${ACTIONLINT_VERSION}_linux_amd64.tar.gz" \
  "$ACTIONLINT_SHA256" actionlint
fetch_binary vale \
  "https://github.com/errata-ai/vale/releases/download/v${VALE_VERSION}/vale_${VALE_VERSION}_Linux_64-bit.tar.gz" \
  "$VALE_SHA256" vale

echo "Add the tools to PATH:"
echo "  export PATH=\"$DIR/bin:$DIR/venv/bin:$ROOT/ci-tools/node_modules/.bin:\$PATH\""
