#!/usr/bin/env bash
# Builds the Stream-to-Clinic profiles (../ig) with SUSHI on top of the OAH IG built by build-ig.sh,
# then writes the definitions the API seeds into the FHIR server to api/src/stc-definitions.json.
# Output: ../ig/fsh-generated/resources (used as a validator -ig folder).
set -euo pipefail

SUSHI_VERSION="${SUSHI_VERSION:-3.20.1}"
OAH_VERSION="0.1.0-ci-build"

here="$(cd "$(dirname "$0")" && pwd)"
root="$(cd "$here/.." && pwd)"
oah="$here/.work/oah/fsh-generated/resources"
packages="${FHIR_PACKAGE_CACHE:-$HOME/.fhir/packages}"

if [[ ! -d "$oah" ]]; then
  echo "OAH IG not built; run ./build-ig.sh first" >&2
  exit 2
fi

# SUSHI resolves dependencies from the local package cache. The OAH IG is not published, so add the
# conformance resources built from source as package hl7.eu.fhir.oah#0.1.0-ci-build.
pkg="$packages/hl7.eu.fhir.oah#$OAH_VERSION/package"
rm -rf "$pkg"
mkdir -p "$pkg"
cp "$oah"/StructureDefinition-*.json "$oah"/ValueSet-*.json "$oah"/CodeSystem-*.json "$pkg"/
cat > "$pkg/package.json" <<JSON
{
  "name": "hl7.eu.fhir.oah",
  "version": "$OAH_VERSION",
  "canonical": "http://hl7.eu/fhir/ig/oah",
  "fhirVersions": ["4.0.1"],
  "dependencies": { "hl7.fhir.r4.core": "4.0.1" }
}
JSON

echo "Running SUSHI $SUSHI_VERSION on ig/"
rm -rf "$root/ig/fsh-generated"
(cd "$root/ig" && npx -y "fsh-sushi@$SUSHI_VERSION" build .)

node "$here/export-definitions.mjs" "$root/ig/fsh-generated/resources" "$root/api/src/stc-definitions.json"
