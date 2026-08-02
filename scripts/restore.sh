#!/usr/bin/env bash
# Restaura backup para um Postgres isolado. NAO toca o banco principal por padrao.
set -euo pipefail
SRC="${1:-}"
if [ -z "$SRC" ]; then
  echo "Uso: $0 /caminho/para/backup" >&2
  exit 1
fi
if [ ! -f "$SRC/manifest.txt" ]; then
  echo "Manifest nao encontrado em $SRC" >&2
  exit 2
fi
sha256sum -c "$SRC/manifest.txt" >/dev/null
echo "Manifest verificado. Restaurar em ambiente isolado com:"
echo "  pg_restore -d <isolated_pg_url> -Fc $SRC/pg.dump"
