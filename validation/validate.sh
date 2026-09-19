#!/usr/bin/env bash
# Validates samples/baseline and samples/generated against FHIR 4.0.1 + the OAH IG built by build-ig.sh.
# Fails on any error; warnings are listed but allowed.
set -uo pipefail

VALIDATOR_VERSION="${VALIDATOR_VERSION:-6.10.4}"
JAVA_XMX="${JAVA_XMX:-1536m}"
TX="${TX:-n/a}" # offline; set TX=https://tx.fhir.org/r4 to also check UCUM and external codes

here="$(cd "$(dirname "$0")" && pwd)"
work="$here/.work"
jar="$work/validator_cli-$VALIDATOR_VERSION.jar"
ig="$work/oah/fsh-generated/resources"
log="$work/validation.log"

if [[ ! -d "$ig" ]]; then
  echo "OAH IG not built; run ./build-ig.sh first" >&2
  exit 2
fi

if [[ ! -f "$jar" ]]; then
  echo "Downloading validator_cli $VALIDATOR_VERSION"
  mkdir -p "$work"
  curl -fsSL --retry 3 -o "$jar.part" \
    "https://github.com/hapifhir/org.hl7.fhir.core/releases/download/$VALIDATOR_VERSION/validator_cli.jar" || exit 2
  mv "$jar.part" "$jar"
fi

inputs=("$here/samples/baseline")
[[ -d "$here/samples/generated" ]] && inputs+=("$here/samples/generated")

java "-Xmx$JAVA_XMX" -jar "$jar" "${inputs[@]}" \
  -version 4.0.1 -ig "$ig" -tx "$TX" > "$log" 2>&1
status=$?

# Per file: its summary line, then its errors and warnings (notes stay in the full log).
grep -E '^-- .* -+$|^(Success|\*FAILURE\*):|^ *(Error|Fatal|Warning) @' "$log" \
  | sed -E -e 's/ -+$//' -e "s#$here/##"
errors=$(grep -cE '^ *(Error|Fatal) @' "$log")
warnings=$(grep -cE '^ *Warning @' "$log")
echo
echo "Total: $errors errors, $warnings warnings. Full log: $log"

if [[ $status -ne 0 || $errors -ne 0 ]]; then
  echo "FHIR validation failed (validator exit $status)" >&2
  exit 1
fi
echo "FHIR validation passed"
