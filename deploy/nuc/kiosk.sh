#!/usr/bin/env bash
# Startar Förhandlingen i kiosk på NUC:ens TVÅ skärmar:
#   vänster skärm  = Valv Syd  (#lag1)
#   höger skärm    = Valv Nord (#lag2)
# Fönstren synkas via same-origin-reläet (bygget använder VITE_RELAY_PATH=/ws),
# så de behöver inte dela webbläsarprofil.
#
# Körs i en grafisk session (X11). Konfig via miljövariabler (se nedan) eller
# en valfri deploy/nuc/kiosk.env bredvid detta skript.
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# Ladda lokal konfig om den finns (skapa från kiosk.env.example vid behov).
[ -f "$HERE/kiosk.env" ] && . "$HERE/kiosk.env"

# --- Konfig (miljövariabler med rimliga defaults) ---
URL_BASE="${URL_BASE:-http://localhost:8080}"   # servern (systemd-tjänsten)
SCREEN_W="${SCREEN_W:-1920}"                     # vänster skärms bredd (px) → höger fönstrets x
LEFT_POS="${LEFT_POS:-0,0}"
RIGHT_POS="${RIGHT_POS:-${SCREEN_W},0}"
PROFILE_DIR="${PROFILE_DIR:-$HOME/.forhandlingen-kiosk}"
# Valfritt: andra musen (namn/id ur `xinput list`) → egen pekare för höger skärm.
SECOND_MOUSE="${SECOND_MOUSE:-}"
# Valfritt: ljud per valv - peka varje valv till sin ljudutgang (pactl list short sinks).
SINK_LEFT="${SINK_LEFT:-}"
SINK_RIGHT="${SINK_RIGHT:-}"
# Valfritt (för touch senare): mappa touch-enheter till rätt HDMI-utgång.
TOUCH_LEFT="${TOUCH_LEFT:-}"    ; OUTPUT_LEFT="${OUTPUT_LEFT:-}"
TOUCH_RIGHT="${TOUCH_RIGHT:-}"  ; OUTPUT_RIGHT="${OUTPUT_RIGHT:-}"

# --- Hitta Chromium/Chrome ---
BROWSER=""
for b in chromium chromium-browser google-chrome google-chrome-stable; do
  if command -v "$b" >/dev/null 2>&1; then BROWSER="$b"; break; fi
done
if [ -z "$BROWSER" ]; then
  echo "kiosk.sh: hittade ingen chromium/chrome i PATH — installera chromium." >&2
  exit 1
fi

# --- Vänta tills servern svarar (hälsokoll) ---
echo "kiosk.sh: väntar på $URL_BASE/healthz ..."
for _ in $(seq 1 60); do
  if curl -fsS "$URL_BASE/healthz" >/dev/null 2>&1; then break; fi
  sleep 1
done

# --- Valfritt: andra musen som egen pekare (Multi-Pointer X, kräver X11) ---
if [ -n "$SECOND_MOUSE" ] && command -v xinput >/dev/null 2>&1; then
  if ! xinput list --name-only 2>/dev/null | grep -q '^Nord pointer$'; then
    xinput create-master Nord || true
  fi
  xinput reattach "$SECOND_MOUSE" "Nord pointer" || \
    echo "kiosk.sh: kunde inte koppla mus '$SECOND_MOUSE' — kolla namnet med 'xinput list'." >&2
fi

# --- Valfritt: touch → skärm-mappning (för touchskärmar senare) ---
if command -v xinput >/dev/null 2>&1; then
  [ -n "$TOUCH_LEFT" ]  && [ -n "$OUTPUT_LEFT" ]  && xinput map-to-output "$TOUCH_LEFT"  "$OUTPUT_LEFT"  || true
  [ -n "$TOUCH_RIGHT" ] && [ -n "$OUTPUT_RIGHT" ] && xinput map-to-output "$TOUCH_RIGHT" "$OUTPUT_RIGHT" || true
fi

# --- Gemensamma flaggor ---
# OZONE=x11 tvingar Chromium via XWayland → --window-position funkar även på en
# Wayland-session (och är native på Xorg). Sätt OZONE=wayland för ren Wayland.
# INTE --kiosk: vi vill att appens "Avsluta"-knapp (window.close) ska kunna
# stänga fönstren tillbaka till skrivbordet. --start-fullscreen + --app ger ändå
# ett rent helskärmsfönster utan flikar/adressfält.
OZONE="${OZONE:-x11}"
common_flags=(
  "--ozone-platform=$OZONE"
  --start-fullscreen
  --noerrdialogs
  --disable-infobars
  --disable-session-crashed-bubble
  --disable-features=TranslateUI
  --overscroll-history-navigation=0
  --autoplay-policy=no-user-gesture-required
  --check-for-update-interval=31536000
)

launch() {
  local hash="$1" pos="$2" prof="$3" sink="$4"
  local pre=()
  [ -n "$sink" ] && pre=(env "PULSE_SINK=$sink")
  "${pre[@]}" "$BROWSER" "${common_flags[@]}" \
    --user-data-dir="$PROFILE_DIR/$prof" \
    --window-position="$pos" \
    --app="$URL_BASE/#$hash" &
}

echo "kiosk.sh: startar Valv Syd (#lag1) och Valv Nord (#lag2)"
launch lag1 "$LEFT_POS" syd "$SINK_LEFT"
sleep 1
launch lag2 "$RIGHT_POS" nord "$SINK_RIGHT"

wait
