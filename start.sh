#!/usr/bin/env bash
# ChipRank Lab — quick local start
# Requirements: Node.js 18+, iverilog on PATH (or Docker)

set -e
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo ""
echo "╔══════════════════════════════════════════════╗"
echo "║         ChipRank Lab — Local Start           ║"
echo "╚══════════════════════════════════════════════╝"
echo ""

# Check iverilog
if ! command -v iverilog &>/dev/null; then
  echo "⚠  iverilog not found on PATH."
  echo "   Install it first:"
  echo "     Ubuntu/Debian : sudo apt install iverilog"
  echo "     macOS         : brew install icarus-verilog"
  echo "     Windows       : https://bleyer.org/icarus/"
  echo ""
  echo "   Or start with Docker instead:"
  echo "     docker compose up --build"
  echo ""
  exit 1
fi
echo "✓ iverilog  : $(iverilog -V 2>&1 | head -1)"

if command -v verilator &>/dev/null; then
  echo "✓ verilator : $(verilator --version | head -1)"
else
  echo "  verilator : not found (optional)"
fi

# Install npm deps if needed
cd "$SCRIPT_DIR/backend"
if [ ! -d node_modules ]; then
  echo ""
  echo "Installing npm dependencies…"
  npm install
fi

echo ""
echo "Starting backend on http://localhost:3001"
echo "Open chipranklab.html in your browser."
echo ""
echo "Press Ctrl+C to stop."
echo ""

node src/server.js
