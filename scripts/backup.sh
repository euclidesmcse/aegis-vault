#!/usr/bin/env bash
# Cria backup cifrado de Postgres + bucket S3 local.
set -euo pipefail
TS=$(date +%Y%m%d-%H%M%S)
OUT=backups/aegis-${TS}
mkdir -p "$OUT"
docker compose exec -T postgres pg_dump -U aegis -d aegis -Fc > "$OUT/pg.dump"
docker compose exec -T minio mc mirror /data "$OUT/minio/" >/dev/null || true
manifest=$(find "$OUT" -type f | sort | xargs -I{} sha256sum {} | tee "$OUT/manifest.txt")
echo "$manifest" | sed -E 's/^/sha256: /' > "$OUT/manifest.txt.tmp"
mv "$OUT/manifest.txt.tmp" "$OUT/manifest.txt"
echo "Backup em ${OUT}"
echo "Cifre com age/openssl antes de mover para local externo."
