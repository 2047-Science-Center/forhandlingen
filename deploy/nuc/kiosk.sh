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
# Föredra icke-snap (Google Chrome .deb): snap-Chromium struntar ofta i
# per-process-ljudrouting (PULSE_SINK), vilket krävs för ljud per valv.
# Sätt BROWSER_BIN i kiosk.env för att tvinga en specifik webbläsare.
BROWSER="${BROWSER_BIN:-}"
if [ -z "$BROWSER" ]; then
  for b in google-chrome-stable google-chrome chromium-browser chromium; do
    if command -v "$b" >/dev/null 2>&1; then BROWSER="$b"; break; fi
  done
fi
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
  local hash="$1" pos="$2" prof="$3" sink="$4" tag="$5"
  # Tagga strömmen (application.name) så vi kan flytta rätt ström nedan, och
  # sätt PULSE_SINK som förstahandsval.
  local pre=(env "PULSE_PROP=application.name=$tag")
  [ -n "$sink" ] && pre+=("PULSE_SINK=$sink")
  "${pre[@]}" "$BROWSER" "${common_flags[@]}" \
    --user-data-dir="$PROFILE_DIR/$prof" \
    --window-position="$pos" \
    --app="$URL_BASE/#$hash" &
}

# Robust ljud-routing: håll ALLA av ett valvs ljudströmmar på rätt utgång så
# länge valvets webbläsare lever. Ett fönster har typiskt TVÅ strömmar — en
# mediaström (berättarrösten) och en Web Audio-ström (klick-ljudeffekterna, som
# ofta dyker upp först när de klickar). Fallback ifall PULSE_SINK ignoreras
# (t.ex. snap-Chromium på PipeWire).
route_audio() {
  local tag="$1" sink="$2" prof="$3"
  [ -z "$sink" ] && return 0
  command -v pactl >/dev/null 2>&1 || return 0
  command -v python3 >/dev/null 2>&1 || return 0
  (
    set +e
    moved=0
    while pgrep -f "$PROFILE_DIR/$prof" >/dev/null 2>&1; do
      ids=$(pactl -f json list sink-inputs 2>/dev/null | python3 -c '
import sys, json
try:
    data = json.load(sys.stdin)
except Exception:
    sys.exit(0)
tag = sys.argv[1]
for si in data:
    if si.get("properties", {}).get("application.name") == tag:
        print(si.get("index", ""))
' "$tag" 2>/dev/null)
      for id in $ids; do
        pactl move-sink-input "$id" "$sink" >/dev/null 2>&1
      done
      if [ "$moved" = 0 ] && [ -n "${ids:-}" ]; then
        echo "kiosk.sh: $tag → $sink"
        moved=1
      fi
      sleep 3
    done
  ) &
}

echo "kiosk.sh: startar Valv Syd (#lag1) och Valv Nord (#lag2)"
launch lag1 "$LEFT_POS" syd "$SINK_LEFT" ValvSyd
sleep 1
launch lag2 "$RIGHT_POS" nord "$SINK_RIGHT" ValvNord

route_audio ValvSyd "$SINK_LEFT" syd
route_audio ValvNord "$SINK_RIGHT" nord

wait
