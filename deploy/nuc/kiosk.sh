#!/usr/bin/env bash
# Startar Förhandlingen i kiosk på NUC:ens TVÅ skärmar:
#   vänster skärm  = Valv Syd  (#lag1)
#   höger skärm    = Valv Nord (#lag2)
# Fönstren synkas via same-origin-reläet (bygget använder VITE_RELAY_PATH=/ws),
# så de behöver inte dela webbläsarprofil.
#
# Körs i en grafisk session (X11; på Linux Mint = Cinnamon, INTE "Cinnamon on
# Wayland"). Konfig via miljövariabler (se nedan) eller en valfri
# deploy/nuc/kiosk.env bredvid detta skript.
#
# Starta/starta om/uppdatera från skrivbordet: använd start.sh / restart.sh /
# update.sh (de sköter att inte få dubbla fönster). Det här skriptet är själva
# motorn — kör det direkt bara för felsökning.
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# Ladda lokal konfig om den finns (skapa från kiosk.env.example vid behov).
# load_kiosk_env städar bort CR/icke-brytbara blanksteg innan filen läses.
. "$HERE/_common.sh"
load_kiosk_env

if [ "${XDG_SESSION_TYPE:-}" = "wayland" ]; then
  echo "kiosk.sh: VARNING: Wayland-session. Touch-mappning och exakt fönsterplacering" >&2
  echo "          funkar inte pålitligt. Logga ut och välj sessionen 'Cinnamon' (X11)." >&2
fi

# --- Konfig (miljövariabler med rimliga defaults) ---
URL_BASE="${URL_BASE:-http://localhost:8080}"   # servern (systemd-tjänsten)
PROFILE_DIR="${PROFILE_DIR:-$HOME/.forhandlingen-kiosk}"
# Vilka valv som startas: both (default) | syd | nord. syd/nord = ETT fönster —
# praktiskt när man testar på en enda skärm.
VALV="${VALV:-both}"
WATCH_PID=""    # pid för självläkande touch-bevakning (om TOUCH_WATCH satt)

# Fönsterpositioner. Sätter du inget explicit (SCREEN_W / LEFT_POS / RIGHT_POS)
# läser vi skärmarna ur `xrandr --listmonitors`: vänstraste = Valv Syd, högraste
# = Valv Nord. Hittas bara EN skärm (eller xrandr saknas) används gamla defaulten:
# vänster 0,0 och höger 1920,0.
# Utskrift: en rad "x y" per unik skärmposition, sorterad från vänster till höger.
monitor_positions() {
  command -v xrandr >/dev/null 2>&1 || return 0
  xrandr --listmonitors 2>/dev/null | awk 'NR>1 {
      s=$3; sub(/^[0-9]+\/[0-9]+x[0-9]+\/[0-9]+/, "", s)
      n=split(s, a, "+"); if (n>=3) print a[2], a[3]
    }' | sort -n -u
}
if [ -z "${SCREEN_W:-}" ] && [ -z "${LEFT_POS:-}" ] && [ -z "${RIGHT_POS:-}" ]; then
  _mp="$(monitor_positions || true)"
  if [ "$(printf '%s\n' "$_mp" | grep -c .)" -ge 2 ]; then
    LEFT_POS="$(printf '%s\n' "$_mp" | head -1 | awk '{print $1","$2}')"
    RIGHT_POS="$(printf '%s\n' "$_mp" | tail -1 | awk '{print $1","$2}')"
    echo "kiosk.sh: skärmar auto-upptäckta: vänster=$LEFT_POS höger=$RIGHT_POS"
  fi
fi
SCREEN_W="${SCREEN_W:-1920}"                     # vänster skärms bredd (px) → höger fönstrets x
LEFT_POS="${LEFT_POS:-0,0}"
RIGHT_POS="${RIGHT_POS:-${SCREEN_W},0}"
# Valfritt: andra musen (namn/id ur `xinput list`) → egen pekare för höger skärm.
SECOND_MOUSE="${SECOND_MOUSE:-}"
# Valfritt: ljud per valv - peka varje valv till sin ljudutgang (pactl list short sinks).
SINK_LEFT="${SINK_LEFT:-}"
SINK_RIGHT="${SINK_RIGHT:-}"
# Touch → skärm-mappning. Två sätt:
#  - Olika paneler: sätt TOUCH_LEFT/RIGHT = enhetsnamn ur `xinput list`.
#  - IDENTISKA paneler (samma namn): sätt TOUCH_PATH_LEFT/RIGHT = USB-portens
#    ID_PATH (ur `udevadm info -q property <node> | grep ID_PATH`), så mappningen
#    binds till fysisk USB-port och håller över omstart.
# OUTPUT_* = skärmnamn ur `xrandr --listmonitors` (t.ex. DP-1 / DP-3 / HDMI-1).
TOUCH_LEFT="${TOUCH_LEFT:-}"            ; OUTPUT_LEFT="${OUTPUT_LEFT:-}"
TOUCH_RIGHT="${TOUCH_RIGHT:-}"         ; OUTPUT_RIGHT="${OUTPUT_RIGHT:-}"
TOUCH_PATH_LEFT="${TOUCH_PATH_LEFT:-}"
TOUCH_PATH_RIGHT="${TOUCH_PATH_RIGHT:-}"

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

# --- Touch → skärm-mappning ---
# Matcha en panel på dess USB-port (ID_PATH) och mappa till rätt skärm. Binds
# till fysisk port → håller över omstart även för IDENTISKA paneler (samma namn,
# där xinput-id kan byta plats mellan boots).
map_touch_by_path() {
  local want="$1" output="$2" id node path
  [ -n "$want" ] && [ -n "$output" ] || return 0
  for id in $(xinput list --id-only 2>/dev/null); do
    node=$(xinput list-props "$id" 2>/dev/null | sed -n 's/.*Device Node[^"]*"\([^"]*\)".*/\1/p')
    [ -n "$node" ] || continue
    path=$(udevadm info -q property "$node" 2>/dev/null | sed -n 's/^ID_PATH=//p')
    if [ "$path" = "$want" ]; then
      if xinput map-to-output "$id" "$output"; then echo "kiosk.sh: touch $want → $output"; fi
      return 0
    fi
  done
  echo "kiosk.sh: touch-panel $want hittades inte (rätt USB-port ikopplad?)" >&2
}
if command -v xinput >/dev/null 2>&1; then
  if [ -n "$TOUCH_PATH_LEFT" ] || [ -n "$TOUCH_PATH_RIGHT" ]; then
    # Port-baserat (identiska paneler)
    if command -v udevadm >/dev/null 2>&1; then
      if [ "${TOUCH_WATCH:-0}" -gt 0 ] 2>/dev/null; then
        # SJÄLVLÄKANDE: map-touch.sh applicerar om mappningen var N:e sekund
        # (läker efter inloggnings-reset, skärm-hotplug, strömblink). Stoppas
        # av restart.sh/start.sh tillsammans med kiosken.
        touch_args=()
        if [ -n "$TOUCH_PATH_LEFT" ] && [ -n "$OUTPUT_LEFT" ]; then
          touch_args+=("$TOUCH_PATH_LEFT" "$OUTPUT_LEFT")
        fi
        if [ -n "$TOUCH_PATH_RIGHT" ] && [ -n "$OUTPUT_RIGHT" ]; then
          touch_args+=("$TOUCH_PATH_RIGHT" "$OUTPUT_RIGHT")
        fi
        if [ "${#touch_args[@]}" -gt 0 ]; then
          MAP_TOUCH_WATCH="$TOUCH_WATCH" MAP_TOUCH_DELAY=0 bash "$HERE/map-touch.sh" "${touch_args[@]}" &
          WATCH_PID=$!
          echo "kiosk.sh: touch-mappning i självläkande läge (var ${TOUCH_WATCH}:e sek)"
        fi
      else
        map_touch_by_path "$TOUCH_PATH_LEFT"  "$OUTPUT_LEFT"
        map_touch_by_path "$TOUCH_PATH_RIGHT" "$OUTPUT_RIGHT"
      fi
    else
      echo "kiosk.sh: udevadm saknas — kan inte port-mappa touch." >&2
    fi
  else
    # Namn-baserat (olika paneler)
    [ -n "$TOUCH_LEFT" ]  && [ -n "$OUTPUT_LEFT" ]  && xinput map-to-output "$TOUCH_LEFT"  "$OUTPUT_LEFT"  || true
    [ -n "$TOUCH_RIGHT" ] && [ -n "$OUTPUT_RIGHT" ] && xinput map-to-output "$TOUCH_RIGHT" "$OUTPUT_RIGHT" || true
  fi
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
  --no-first-run
  --no-default-browser-check
  --noerrdialogs
  --disable-infobars
  --disable-session-crashed-bubble
  --disable-features=TranslateUI
  --overscroll-history-navigation=0
  --autoplay-policy=no-user-gesture-required
  --check-for-update-interval=31536000
)

LAUNCH_PIDS=()
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
  LAUNCH_PIDS+=("$!")
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

echo "kiosk.sh: startar Valv Syd (#lag1) och Valv Nord (#lag2)  [VALV=$VALV, webbläsare: $BROWSER]"
case "$VALV" in
  syd)
    launch lag1 "$LEFT_POS" syd "$SINK_LEFT" ValvSyd
    route_audio ValvSyd "$SINK_LEFT" syd
    ;;
  nord)
    launch lag2 "$RIGHT_POS" nord "$SINK_RIGHT" ValvNord
    route_audio ValvNord "$SINK_RIGHT" nord
    ;;
  *)
    launch lag1 "$LEFT_POS" syd "$SINK_LEFT" ValvSyd
    # Låt första fönstret bli klart innan det andra startas (annars kan andra bli
    # tomt/vitt vid start). Justera med LAUNCH_GAP i kiosk.env vid behov.
    sleep "${LAUNCH_GAP:-4}"
    launch lag2 "$RIGHT_POS" nord "$SINK_RIGHT" ValvNord
    route_audio ValvSyd "$SINK_LEFT" syd
    route_audio ValvNord "$SINK_RIGHT" nord
    ;;
esac

# Vänta tills fönstren stängs (✕ Avsluta i appen, eller restart.sh). Städa sedan
# touch-bevakningen så inget bakgrundsskräp blir kvar.
wait "${LAUNCH_PIDS[@]}" 2>/dev/null || true
[ -z "$WATCH_PID" ] || kill "$WATCH_PID" 2>/dev/null || true
echo "kiosk.sh: fönstren stängda — klart."
