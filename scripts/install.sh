#!/usr/bin/env bash
# Verifica pre-requisitos e prepara .env.
set -euo pipefail

required_bins=(docker 'docker compose' openssl)
missing=()
for b in "${required_bins[@]}"; do
  if ! command -v $b >/dev/null 2>&1; then
    missing+=("$b")
  fi
done
if [ ${#missing[@]} -gt 0 ]; then
  echo "Faltam binarios: ${missing[*]}" >&2
  echo "Instale Docker 24+ e docker compose v2 antes de continuar." >&2
  exit 1
fi

if ! [ -f .env ]; then
  cp .env.example .env
fi

# Garante SESSION_SECRET >= 48 bytes em base64.
if grep -q '^SESSION_SECRET=replace' .env; then
  s=$(openssl rand -base64 48)
  sed -i.bak -E "s|^SESSION_SECRET=.*$|SESSION_SECRET=${s}|" .env
fi

echo "Ambiente preparado.  Para iniciar:"
echo "  docker compose up -d --build"
