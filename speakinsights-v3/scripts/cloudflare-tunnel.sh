#!/usr/bin/env bash
# =============================================================================
# SpeakInsights v3 — Cloudflare Tunnel Script
# =============================================================================
# Exposes your local SpeakInsights instance to the internet via Cloudflare
# Tunnel (free, no account required for quick tunnels).
#
# Usage:
#   chmod +x scripts/cloudflare-tunnel.sh
#   ./scripts/cloudflare-tunnel.sh
#
# The generated URL can be shared with anyone (e.g., professor for demo).
# Traffic is routed: Internet → Cloudflare → localhost:3000 (nginx → app)
# =============================================================================

set -euo pipefail

PORT="${1:-3000}"
BOLD="\033[1m"
CYAN="\033[36m"
GREEN="\033[32m"
YELLOW="\033[33m"
RED="\033[31m"
RESET="\033[0m"

echo -e "${CYAN}${BOLD}"
echo "╔══════════════════════════════════════════════╗"
echo "║   SpeakInsights v3 — Cloudflare Tunnel       ║"
echo "╚══════════════════════════════════════════════╝"
echo -e "${RESET}"

# ── Step 1: Check / install cloudflared ──────────────────────────────────
install_cloudflared() {
    echo -e "${YELLOW}cloudflared not found. Installing...${RESET}"

    if [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS
        if command -v brew &>/dev/null; then
            echo "Installing via Homebrew..."
            brew install cloudflared
        else
            echo -e "${RED}Homebrew not found. Install cloudflared manually:${RESET}"
            echo "  brew install cloudflared"
            echo "  OR download from https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/"
            exit 1
        fi
    elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
        # Linux
        if command -v apt-get &>/dev/null; then
            echo "Installing via apt..."
            curl -L --output /tmp/cloudflared.deb \
                https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb
            sudo dpkg -i /tmp/cloudflared.deb
            rm /tmp/cloudflared.deb
        elif command -v yum &>/dev/null; then
            echo "Installing via yum..."
            curl -L --output /tmp/cloudflared.rpm \
                https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-x86_64.rpm
            sudo yum localinstall -y /tmp/cloudflared.rpm
            rm /tmp/cloudflared.rpm
        else
            echo -e "${RED}Could not detect package manager. Install cloudflared manually:${RESET}"
            echo "  https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/"
            exit 1
        fi
    else
        echo -e "${RED}Unsupported OS: $OSTYPE${RESET}"
        echo "Download cloudflared from: https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/"
        exit 1
    fi
}

if ! command -v cloudflared &>/dev/null; then
    install_cloudflared
fi

echo -e "${GREEN}✓ cloudflared installed: $(cloudflared --version 2>&1 | head -1)${RESET}"

# ── Step 2: Check that SpeakInsights is running ─────────────────────────
echo -e "\n${CYAN}Checking if SpeakInsights is running on port ${PORT}...${RESET}"

if curl -s --max-time 3 "http://localhost:${PORT}" > /dev/null 2>&1; then
    echo -e "${GREEN}✓ SpeakInsights is reachable on http://localhost:${PORT}${RESET}"
else
    echo -e "${YELLOW}⚠ Could not reach http://localhost:${PORT}${RESET}"
    echo -e "  Make sure Docker Compose is running:  docker compose up -d"
    echo -e "  Continuing anyway — tunnel will wait for the service.\n"
fi

# ── Step 3: Start the tunnel ────────────────────────────────────────────
echo -e "\n${CYAN}${BOLD}Starting Cloudflare Tunnel → http://localhost:${PORT}${RESET}"
echo -e "${YELLOW}The generated URL will appear below. Share it with anyone!${RESET}"
echo -e "${YELLOW}Press Ctrl+C to stop the tunnel.${RESET}\n"
echo "────────────────────────────────────────────────"

# Quick tunnel (no Cloudflare account needed)
cloudflared tunnel --url "http://localhost:${PORT}" 2>&1 | while IFS= read -r line; do
    # Highlight the generated URL
    if echo "$line" | grep -qE "https://.*trycloudflare\.com"; then
        URL=$(echo "$line" | grep -oE "https://[a-z0-9-]+\.trycloudflare\.com")
        echo -e "\n${GREEN}${BOLD}╔══════════════════════════════════════════════╗${RESET}"
        echo -e "${GREEN}${BOLD}║  PUBLIC URL: ${URL}${RESET}"
        echo -e "${GREEN}${BOLD}╚══════════════════════════════════════════════╝${RESET}\n"
        echo -e "Share this URL with your professor or teammates."
        echo -e "They can access the full SpeakInsights platform through it.\n"
    fi
    echo "$line"
done
