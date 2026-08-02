#!/usr/bin/env bash
# Gera SBOM CycloneDX. Requer `pnpm` instalado.
# Em ambientes onde pnpm nao esteja disponível, usa node para um stub minimo.
set -euo pipefail
TS=$(date +%Y%m%d)
OUT=sbom/aegis-${TS}
mkdir -p "$OUT"

if command -v pnpm >/dev/null 2>&1; then
  echo "pnpm detectado. Gerando SBOM CycloneDX via npx..."
  if command -v npx >/dev/null 2>&1; then
    npx -y @cyclonedx/cyclonedx-npm --output-format JSON --output-file "$OUT/aegis-sbom.cdx.json" || true
  fi
fi

# Stub minimo via node (uma unica chamada JSON.stringify).
node -e '
const fs = require("node:fs");
const path = require("node:path");
const components = [];
function walk(dir) {
  for (const f of fs.readdirSync(dir)) {
    const p = path.join(dir, f, "package.json");
    if (fs.existsSync(p)) {
      try {
        const pkg = JSON.parse(fs.readFileSync(p, "utf-8"));
        components.push({ type: "library", name: pkg.name ?? p, version: pkg.version ?? "0.0.0", purl: "pkg:npm/" + (pkg.name ?? "?") + "@" + (pkg.version ?? "?") });
      } catch {}
    }
  }
}
walk(path.resolve("apps"));
walk(path.resolve("packages"));
fs.writeFileSync(path.resolve(process.argv[2], "aegis-sbom.stub.json"), JSON.stringify({ bomFormat: "CycloneDX-stub", specVersion: "1.5", components }, null, 2) + "\n");
console.log("SBOM stub OK with", components.length, "components");
' "$OUT"
echo "Output em $OUT"
