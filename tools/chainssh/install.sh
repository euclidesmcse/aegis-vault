#!/usr/bin/env bash
set -euo pipefail

# ── chainssh build script ─────────────────────────────────────────────
# Compiles chainssh for Linux, Windows, and macOS.
# Output: build/chainssh-{linux,windows,darwin}-{amd64,arm64}[.exe]
#
# Usage: ./install.sh

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
BUILD_DIR="$SCRIPT_DIR/build"
VERSION=$(git describe --tags --always --dirty 2>/dev/null || echo "dev")

# ── Colors ────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
CYAN='\033[0;36m'; BOLD='\033[1m'; NC='\033[0m'

info()  { echo -e "${CYAN}→${NC} $1"; }
ok()    { echo -e "  ${GREEN}✓${NC} $1"; }
warn()  { echo -e "  ${YELLOW}⚠${NC} $1"; }
fail()  { echo -e "  ${RED}✗${NC} $1"; }
header(){ echo -e "\n${BOLD}${CYAN}═══ $1 ═══${NC}\n"; }

# ── Prerequisites ─────────────────────────────────────────────────────

header "chainssh build script"

# Check Go
if ! command -v go &> /dev/null; then
    echo -e "${RED}Error: Go is not installed.${NC}"
    echo "Download: https://go.dev/dl/"
    exit 1
fi

GO_VERSION=$(go version | awk '{print $3}' | sed 's/^go//')
REQUIRED="1.23"
if [ "$(printf '%s\n' "$REQUIRED" "$GO_VERSION" | sort -V | head -1)" != "$REQUIRED" ]; then
    echo -e "${RED}Error: Go $REQUIRED+ required (found $GO_VERSION).${NC}"
    exit 1
fi

info "Go $GO_VERSION detected"
info "Version: $VERSION"

# ── Dependencies ──────────────────────────────────────────────────────

info "Resolving dependencies..."
cd "$SCRIPT_DIR"
go mod tidy 2>&1 | while read -r line; do warn "$line"; done
ok "Dependencies resolved"

# ── Build targets ─────────────────────────────────────────────────────

TARGETS=(
    "linux|amd64"
    "linux|arm64"
    "windows|amd64"
    "darwin|amd64"
    "darwin|arm64"
)

# Clean previous build
rm -rf "$BUILD_DIR"
mkdir -p "$BUILD_DIR"

LDFLAGS="-s -w"

header "Building ($(echo ${#TARGETS[@]}) targets)"

BUILT=()
FAILED=()

for target in "${TARGETS[@]}"; do
    GOOS="${target%%|*}"
    GOARCH="${target##*|}"
    EXT=""
    [[ "$GOOS" == "windows" ]] && EXT=".exe"

    OUTPUT="$BUILD_DIR/chainssh-${GOOS}-${GOARCH}${EXT}"
    LABEL="${GOOS}/${GOARCH}"

    printf "  %-18s " "$LABEL"
    
    if CGO_ENABLED=0 GOOS="$GOOS" GOARCH="$GOARCH" \
        go build -ldflags="$LDFLAGS" -o "$OUTPUT" . 2>/tmp/chainssh-build-err; then
        SIZE=$(du -h "$OUTPUT" | cut -f1)
        echo -e "${GREEN}✓${NC}  ${SIZE}"
        BUILT+=("$OUTPUT")
    else
        echo -e "${RED}✗${NC}  failed"
        cat /tmp/chainssh-build-err >&2
        FAILED+=("$LABEL")
    fi
done

rm -f /tmp/chainssh-build-err

# ── Summary ───────────────────────────────────────────────────────────

header "Summary"

if [ ${#BUILT[@]} -gt 0 ]; then
    echo -e "${BOLD}  Built:${NC}"
    for binary in "${BUILT[@]}"; do
        name=$(basename "$binary")
        size=$(du -h "$binary" | cut -f1)
        echo -e "    ${GREEN}✓${NC} $name  ${CYAN}($size)${NC}"
    done
fi

if [ ${#FAILED[@]} -gt 0 ]; then
    echo -e "\n${BOLD}${RED}  Failed:${NC}"
    for label in "${FAILED[@]}"; do
        echo -e "    ${RED}✗${NC} $label"
    done
fi

echo ""
echo -e "${BOLD}Output:${NC} ${BUILD_DIR}/"
ls -lh "$BUILD_DIR" 2>/dev/null | tail -n +2

# Quick test: run --help on the native binary
NATIVE_OS=$(go env GOOS)
NATIVE_ARCH=$(go env GOARCH)
NATIVE_BIN="$BUILD_DIR/chainssh-${NATIVE_OS}-${NATIVE_ARCH}"
[[ "$NATIVE_OS" == "windows" ]] && NATIVE_BIN="${NATIVE_BIN}.exe"

if [ -f "$NATIVE_BIN" ]; then
    echo ""
    echo -e "${BOLD}Quick test:${NC}"
    "$NATIVE_BIN" --help 2>&1 | head -3
fi

if [ ${#FAILED[@]} -eq 0 ]; then
    echo -e "\n${GREEN}${BOLD}All targets built successfully!${NC} ✓"
else
    echo -e "\n${YELLOW}${BOLD}Build completed with ${#FAILED[@]} failure(s).${NC}"
fi
