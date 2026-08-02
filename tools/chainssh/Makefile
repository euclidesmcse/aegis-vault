# ── chainssh Makefile ────────────────────────────────────────────────────
# Cross-platform build automation for the multi-hop SSH tool.
#
# Requires: GNU Make >= 4.0 (for ** wildcard) and Go >= 1.23.
# macOS users: brew install make   (installs gmake)
#
# Usage:
#   make          — build native binary
#   make build    — build native binary
#   make build-all— cross-compile all 5 targets
#   make test     — go vet + go test
#   make clean    — remove build artifacts
#   make fmt      — format all Go source
#   make lint     — static analysis (go vet)
#   make tidy     — go mod tidy
#   make help     — show this help

# ── Variables ────────────────────────────────────────────────────────────

BINARY   := chainssh
BUILD_DIR := build
LDFLAGS  := -s -w
GO       := go
GOFMT    := gofmt

# Platform matrix
TARGETS := \
	linux/amd64 \
	linux/arm64 \
	windows/amd64 \
	darwin/amd64 \
	darwin/arm64

# Detect native OS/arch
NATIVE_OS   := $(shell $(GO) env GOOS 2>/dev/null || echo unknown)
NATIVE_ARCH := $(shell $(GO) env GOARCH 2>/dev/null || echo unknown)
NATIVE_EXT  := $(if $(filter windows,$(NATIVE_OS)),.exe,)
NATIVE_BIN  := $(BUILD_DIR)/$(BINARY)-$(NATIVE_OS)-$(NATIVE_ARCH)$(NATIVE_EXT)

# Colors (use NO_COLOR=1 to disable)
ifndef NO_COLOR
  GREEN  := \033[0;32m
  CYAN   := \033[0;36m
  YELLOW := \033[1;33m
  BOLD   := \033[1m
  NC     := \033[0m
endif

# ── Default target ───────────────────────────────────────────────────────

.DEFAULT_GOAL := build

.PHONY: build
build: $(NATIVE_BIN) ## Build native binary
	@printf "$(GREEN)✓$(NC) Built: $(BOLD)%s$(NC)\n" "$(NATIVE_BIN)"

$(NATIVE_BIN): go.mod $(wildcard *.go) $(wildcard internal/**/*.go)
	@mkdir -p $(BUILD_DIR)
	CGO_ENABLED=0 $(GO) build -ldflags="$(LDFLAGS)" -o $@ .

# ── Build all targets ────────────────────────────────────────────────────

# Generate target names: linux/amd64 → build/chainssh-linux-amd64
# For Windows, append .exe so the pattern-rule matches the actual output.
BUILD_TARGETS := $(foreach t,$(TARGETS),\
	$(BUILD_DIR)/$(BINARY)-$(subst /,-,$(t))$(if $(filter windows,$(word 1,$(subst /, ,$(t)))),.exe,))

.PHONY: build-all
build-all: ## Cross-compile for all platforms (5 targets)
	@printf "$(CYAN)═══ Building %d targets ═══$(NC)\n" $(words $(TARGETS))
	@$(MAKE) $(BUILD_TARGETS)
	@printf "\n$(GREEN)✓ All targets built$(NC)\n"
	@ls -lh $(BUILD_DIR)/ | tail -n +2

# Pattern rule: build/chainssh-{os}-{arch}[.exe]
$(BUILD_DIR)/$(BINARY)-%:
	@os_arch=$*; \
	ext=""; \
	case "$$os_arch" in *.exe) ext=".exe"; os_arch=$${os_arch%.exe} ;; esac; \
	os=$${os_arch%-*}; \
	arch=$${os_arch##*-}; \
	printf "  %-18s " "$$os/$$arch"; \
	if CGO_ENABLED=0 GOOS=$$os GOARCH=$$arch \
		$(GO) build -ldflags="$(LDFLAGS)" -o "$@" . 2>/dev/null; then \
		printf "$(GREEN)✓$(NC)  %s\n" "$$(du -h "$@" | cut -f1)"; \
	else \
		printf "$(YELLOW)✗$(NC)  failed\n"; \
	fi

# ── Test & lint ──────────────────────────────────────────────────────────

.PHONY: test
test: lint ## Run go vet + go test
	@printf "$(CYAN)go test ./...$(NC)\n"
	@$(GO) test ./... -count=1 -timeout=30s
	@printf "$(GREEN)✓ Tests complete$(NC)\n"

.PHONY: lint
lint: ## Static analysis (go vet)
	@printf "$(CYAN)go vet ./...$(NC)\n"
	@$(GO) vet ./...

.PHONY: fmt
fmt: ## Format all Go source files
	@printf "$(CYAN)gofmt -w .$(NC)\n"
	@$(GOFMT) -w .

.PHONY: tidy
tidy: ## Resolve Go module dependencies
	@printf "$(CYAN)go mod tidy$(NC)\n"
	@$(GO) mod tidy

# ── Clean ────────────────────────────────────────────────────────────────

.PHONY: clean
clean: ## Remove build artifacts
	@printf "$(YELLOW)Cleaning $(BUILD_DIR)/$(NC)\n"
	@rm -rf $(BUILD_DIR)

# ── Install ──────────────────────────────────────────────────────────────

.PHONY: install
install: build ## Build and install to $GOPATH/bin
	@printf "$(CYAN)go install$(NC)\n"
	CGO_ENABLED=0 $(GO) install -ldflags="$(LDFLAGS)" .

# ── Help ──────────────────────────────────────────────────────────────────

.PHONY: help
help: ## Show this help
	@printf "$(BOLD)chainssh — Multi-hop SSH with dynamic ports$(NC)\n\n"
	@printf "$(CYAN)Targets:$(NC)\n"
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | \
		sort | \
		awk 'BEGIN {FS = ":.*?## "}; \
		{printf "  $(GREEN)%-16s$(NC) %s\n", $$1, $$2}'
	@printf "\n$(CYAN)Variables:$(NC)\n"
	@printf "  BINARY=$(BINARY)  BUILD_DIR=$(BUILD_DIR)\n"
	@printf "  NATIVE: $(NATIVE_OS)/$(NATIVE_ARCH)\n"
