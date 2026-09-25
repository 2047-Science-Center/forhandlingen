#!/usr/bin/env bash
# Engångsinstallation av Förhandlingen som permanent kiosk-station på en Linux-NUC.
#   1) bygger appen med same-origin-relä (npm ci + npm run build:relay)
#   2) installerar en systemd-tjänst för servern (app + relä) med autostart
#   3) installerar en systemd USER-tjänst som startar de två kiosk-fönstren
#
# Kör på NUC:en, från repo-roten:  deploy/nuc/install.sh
# Flaggor:  --server-only   (hoppa över kiosk-tjänsten)
#           --port <n>       (serverport, default 8080)
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO="$(cd "$HERE/../.." && pwd)"
PORT="${PORT:-8080}"
INSTALL_KIOSK=1

while [ $# -gt 0 ]; do
  case "$1" in
    --server-only) INSTALL_KIOSK=0 ;;
    --port) PORT="$2"; shift ;;
    *) echo "Okänd flagga: $1" >&2; exit 1 ;;
  esac
  shift
done

say() { printf '\n\033[1;33m== %s\033[0m\n' "$*"; }

# --- Förkontroller ---
command -v node >/dev/null 2>&1 || { echo "Node saknas. Installera Node 20+ först." >&2; exit 1; }
command -v npm  >/dev/null 2>&1 || { echo "npm saknas. Installera Node 20+ först." >&2; exit 1; }
NODE="$(command -v node)"
NODE_MAJOR="$(node -p 'process.versions.node.split(".")[0]')"
[ "$NODE_MAJOR" -ge 20 ] || echo "Varning: Node $NODE_MAJOR — 20+ rekommenderas."
USER_NAME="$(id -un)"

say "Repo:  $REPO"
say "Node:  $NODE ($(node -v))   Port: $PORT   Användare: $USER_NAME"

# --- 1) Bygg ---
say "Installerar beroenden (npm ci)"
( cd "$REPO" && (npm ci || npm install) )
say "Bygger appen med same-origin-relä (npm run build:relay)"
( cd "$REPO" && npm run build:relay )

# --- 2) Server som systemd-tjänst (system, kräver sudo) ---
say "Installerar systemd-tjänst: forhandlingen-server"
tmp="$(mktemp)"
sed -e "s|@USER@|$USER_NAME|g" -e "s|@REPO@|$REPO|g" -e "s|@PORT@|$PORT|g" -e "s|@NODE@|$NODE|g" \
  "$HERE/forhandlingen-server.service" > "$tmp"
sudo install -m 0644 "$tmp" /etc/systemd/system/forhandlingen-server.service
rm -f "$tmp"
sudo systemctl daemon-reload
sudo systemctl enable --now forhandlingen-server.service
sleep 2
if curl -fsS "http://localhost:$PORT/healthz" >/dev/null 2>&1; then
  say "Servern svarar på http://localhost:$PORT ✓"
else
  echo "Varning: servern svarade inte än — kolla: sudo systemctl status forhandlingen-server" >&2
fi

# --- 3) Kiosk som systemd USER-tjänst ---
if [ "$INSTALL_KIOSK" -eq 1 ]; then
  say "Installerar kiosk-autostart (systemd user)"
  chmod +x "$HERE/kiosk.sh"
  [ -f "$HERE/kiosk.env" ] || cp "$HERE/kiosk.env.example" "$HERE/kiosk.env"
  mkdir -p "$HOME/.config/systemd/user"
  sed -e "s|@REPO@|$REPO|g" \
    "$HERE/forhandlingen-kiosk.service" > "$HOME/.config/systemd/user/forhandlingen-kiosk.service"
  systemctl --user daemon-reload
  systemctl --user enable forhandlingen-kiosk.service || true
  # Så att user-tjänster överlever utloggning/körs vid boot-autologin.
  sudo loginctl enable-linger "$USER_NAME" || true
  say "Kiosk installerad. Den startar automatiskt när den grafiska sessionen loggar in."
  echo "Justera skärmbredd/andra musen/touch i: $HERE/kiosk.env"
  echo "Starta nu (om du redan är inloggad grafiskt):  systemctl --user start forhandlingen-kiosk"
fi

say "Klart."
cat <<EOF

Nästa steg / bra att veta:
  • Autologin till en X11-session krävs för att kiosken ska starta av sig själv
    (se deploy/nuc/NUC-INSTALL.md).
  • Skärmar: vänster = Valv Syd (#lag1), höger = Valv Nord (#lag2).
  • Uppdatera stationen senare:  git pull && npm run build:relay && \\
        sudo systemctl restart forhandlingen-server
  • Loggar:  sudo journalctl -u forhandlingen-server -f
             systemctl --user status forhandlingen-kiosk
EOF
