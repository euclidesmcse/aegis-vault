<#
.SYNOPSIS
    Installs Go (if needed) and compiles chainssh for Windows.

.DESCRIPTION
    Downloads Go, installs it, refreshes PATH,
    then builds chainssh.exe as a single static binary (~8 MB).

.PARAMETER GoVersion
    Go version to install (default: 1.23.5).

.PARAMETER SkipGoInstall
    Skip Go installation — only build chainssh.

.EXAMPLE
    .\install.ps1

.EXAMPLE
    .\install.ps1 -GoVersion 1.23.0

.EXAMPLE
    .\install.ps1 -SkipGoInstall

.NOTES
    If execution policy blocks this script, run:
      powershell -ExecutionPolicy Bypass -File install.ps1
#>

param(
    [string]$GoVersion = "1.23.5",
    [switch]$SkipGoInstall
)

$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$BuildDir = Join-Path $ScriptDir "build"

# ── Helpers ────────────────────────────────────────────────────────────

function Write-Step { param([string]$T)
    Write-Host "`n>> $T" -ForegroundColor Cyan
}
function Write-OK { param([string]$T)
    Write-Host "   OK  $T" -ForegroundColor Green
}
function Write-Warn { param([string]$T)
    Write-Host "   WARN $T" -ForegroundColor Yellow
}
function Write-Fail { param([string]$T)
    Write-Host "   FAIL $T" -ForegroundColor Red
}

# ── Banner ─────────────────────────────────────────────────────────────

Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "  chainssh — Installer & Builder" -ForegroundColor Cyan
Write-Host "  Multi-hop SSH with dynamic ports + SOCKS5 proxy" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan

# ── Step 1: Check / Install Go ─────────────────────────────────────────

if (-not $SkipGoInstall) {
    $goCmd = Get-Command go -ErrorAction SilentlyContinue
    if ($goCmd) {
        $currentVer = (& go version) -replace 'go version go','' -replace ' .*',''
        Write-Step "Go $currentVer already installed — skipping download"
    } else {
        # Check admin rights needed for MSI install
        $isAdmin = ([Security.Principal.WindowsPrincipal] `
            [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole(`
            [Security.Principal.WindowsBuiltInRole]::Administrator)

        if (-not $isAdmin) {
            Write-Fail "Go installation requires Administrator privileges."
            Write-Host ""
            Write-Host "   Options:" -ForegroundColor Yellow
            Write-Host "   1. Run PowerShell as Administrator and re-run this script" -ForegroundColor Yellow
            Write-Host "   2. Install Go manually: https://go.dev/dl/" -ForegroundColor Yellow
            Write-Host "      then run: .\install.ps1 -SkipGoInstall" -ForegroundColor Yellow
            Write-Host ""
            exit 1
        }

        Write-Step "Go not found. Installing Go $GoVersion..."

        $arch = if ([Environment]::Is64BitOperatingSystem) { "amd64" } else { "386" }
        $msiName = "go${GoVersion}.windows-${arch}.msi"
        $msiUrl  = "https://go.dev/dl/$msiName"
        $msiPath = Join-Path $env:TEMP $msiName

        Write-Host "   Downloading $msiUrl ..."
        try {
            Invoke-WebRequest -Uri $msiUrl -OutFile $msiPath -UseBasicParsing
            Write-OK "Downloaded to $msiPath"
        } catch {
            Write-Fail "Download failed: $_"
            Write-Host "   Manual install: https://go.dev/dl/" -ForegroundColor Yellow
            exit 1
        }

        Write-Host "   Installing Go..."
        $proc = Start-Process msiexec.exe `
            -ArgumentList "/i `"$msiPath`" /qn /norestart" `
            -Wait -PassThru
        if ($proc.ExitCode -eq 0) {
            Write-OK "Go $GoVersion installed"
        } else {
            Write-Fail "Install returned code $($proc.ExitCode)"
            Write-Host "   Try manual install: https://go.dev/dl/" -ForegroundColor Yellow
            exit 1
        }

        # Append Go to current session PATH (non-destructive)
        $goBin = "${env:ProgramFiles}\Go\bin"
        if ($env:Path -notlike "*$goBin*") {
            $env:Path = "$goBin;$env:Path"
        }

        # Verify installation
        try {
            $installedVer = (& "$goBin\go.exe" version) -replace 'go version go','' -replace ' .*',''
            Write-OK "Go $installedVer ready"
        } catch {
            Write-Warn "Go installed but PATH may need a terminal restart"
            Write-Warn "Close and reopen PowerShell, then run: .\install.ps1 -SkipGoInstall"
        }
    }
} else {
    Write-Step "Skipping Go install (-SkipGoInstall)"
}

# ── Step 2: Go mod tidy ────────────────────────────────────────────────

Write-Step "Resolving Go dependencies..."
Push-Location $ScriptDir
try {
    go mod tidy 2>&1 | ForEach-Object { Write-Warn $_ }
    Write-OK "Dependencies resolved"
} catch {
    Write-Fail "go mod tidy failed: $_"
    Pop-Location
    exit 1
}

# ── Step 3: Build chainssh ─────────────────────────────────────────────

$output = Join-Path $BuildDir "chainssh.exe"
Write-Step "Building chainssh..."
Write-Host "   Target: $output"

New-Item -ItemType Directory -Force -Path $BuildDir | Out-Null

$env:CGO_ENABLED = "0"
try {
    go build -ldflags="-s -w" -o $output .
    $size = "{0:N1} MB" -f ((Get-Item $output).Length / 1MB)
    Write-OK "Build complete — $size"
} catch {
    Write-Fail "Build failed: $_"
    Pop-Location
    exit 1
}
Pop-Location

# ── Step 4: Quick test ─────────────────────────────────────────────────

Write-Step "Quick test..."
try {
    & $output --help 2>&1 | Select-Object -First 5 | ForEach-Object {
        Write-Host "   $_" -ForegroundColor DarkGray
    }
    Write-OK "--help works"
} catch {
    Write-Warn "Quick test skipped: $_"
}

# ── Summary ────────────────────────────────────────────────────────────

Write-Host ""
Write-Host "============================================================" -ForegroundColor Green
Write-Host "  chainssh compiled successfully!" -ForegroundColor Green
Write-Host ""
Write-Host "  Binary: $output" -ForegroundColor Green
Write-Host "  Size:   $size" -ForegroundColor Green
Write-Host ""
Write-Host "  Usage:" -ForegroundColor Green
Write-Host "    $output admin@jump,root@target" -ForegroundColor Green
Write-Host "    $output -D 1080 jump,server" -ForegroundColor Green
Write-Host "    $output -L 5432:db:5432 jump,db" -ForegroundColor Green
Write-Host "============================================================" -ForegroundColor Green
