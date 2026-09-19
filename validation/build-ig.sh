#!/usr/bin/env bash
# Builds the OneAquaHealth IG (github.com/hl7-eu/oah) from source with SUSHI at a pinned commit.
# Output: .work/oah/fsh-generated/resources (used as the validator's -ig folder).
set -euo pipefail

OAH_COMMIT="${OAH_COMMIT:-b907cf0869b59d82d9138b3d147fca66f333d911}"
SUSHI_VERSION="${SUSHI_VERSION:-3.20.1}"

here="$(cd "$(dirname "$0")" && pwd)"
work="$here/.work"
ig="$work/oah"
stamp="$ig/.built-$OAH_COMMIT-sushi-$SUSHI_VERSION"
packages="${FHIR_PACKAGE_CACHE:-$HOME/.fhir/packages}"

if [[ -f "$stamp" ]]; then
  echo "OAH IG already built at $OAH_COMMIT"
  exit 0
fi

# SUSHI's registry download of hl7.fhir.r4.core is unreliable (large file, frequent truncation),
# so seed the package cache from hl7.org when it is missing.
core="$packages/hl7.fhir.r4.core#4.0.1"
if [[ ! -f "$core/package/package.json" ]]; then
  echo "Seeding hl7.fhir.r4.core#4.0.1 into $packages"
  mkdir -p "$work" "$core"
  curl -fsSL --retry 3 -o "$work/r4core.tgz" https://hl7.org/fhir/R4/hl7.fhir.r4.core.tgz
  tar -xzf "$work/r4core.tgz" -C "$core"
  rm "$work/r4core.tgz"
fi

echo "Fetching hl7-eu/oah@$OAH_COMMIT"
rm -rf "$ig"
mkdir -p "$ig"
curl -fsSL --retry 3 -o "$work/oah.tgz" "https://codeload.github.com/hl7-eu/oah/tar.gz/$OAH_COMMIT"
tar -xzf "$work/oah.tgz" -C "$ig" --strip-components=1
rm "$work/oah.tgz"

echo "Running SUSHI $SUSHI_VERSION"
(cd "$ig" && npx -y "fsh-sushi@$SUSHI_VERSION" build .)

touch "$stamp"
echo "OAH IG built: $(ls "$ig/fsh-generated/resources" | wc -l) resources"
