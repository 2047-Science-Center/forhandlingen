#!/usr/bin/env bash
# reset-touch.sh — mappa om touchpanelerna till rätt skärm EN gång, på begäran.
# Mål för skrivbordsknappen "Återställ touch". Läser touch-config ur kiosk.env
# (samma som kiosk.sh använder). Kräver X11.
#
# Snabb-fix när touch "börjat hamna fel" mellan skärmarna efter replug/resume.
# (Permanent självläkning: sätt TOUCH_WATCH=5 i kiosk.env — då gör kiosken detta
#  automatiskt var 5:e sekund så länge stationen kör.)
#
#   --watch   AUTOSTART vid inloggning (install-launcher.sh lägger posten): vänta 5 s, mappa och
#             fortsätt mappa om var TOUCH_WATCH:e sek (default 5), så touchen funkar direkt efter
#             omstart, oberoende av om spelet startats. Ofarligt ihop med kiosk.sh:s egen bevakning.
set -u
WATCH=0; [ "${1:-}" = "--watch" ] && WATCH=1
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=/dev/null
. "$HERE/_common.sh"
load_kiosk_env

notify() { command -v notify-send >/dev/null 2>&1 && notify-send -t 2500 "Touch" "$1" 2>/dev/null || true; }
done_close() { [ -t 1 ] && read -rp "Enter för att stänga..."; }

if [ "${XDG_SESSION_TYPE:-}" = "wayland" ]; then
  notify "Touch-mappning kräver X11 (du kör Wayland)"
  echo "Wayland: 'xinput map-to-output' stöds inte. Logga in i Cinnamon (X11)." >&2
  done_close; exit 1
fi

TOUCH_LEFT="${TOUCH_LEFT:-}"            ; OUTPUT_LEFT="${OUTPUT_LEFT:-}"
TOUCH_RIGHT="${TOUCH_RIGHT:-}"          ; OUTPUT_RIGHT="${OUTPUT_RIGHT:-}"
TOUCH_PATH_LEFT="${TOUCH_PATH_LEFT:-}"  ; TOUCH_PATH_RIGHT="${TOUCH_PATH_RIGHT:-}"

rc=0
if [ -n "$TOUCH_PATH_LEFT" ] || [ -n "$TOUCH_PATH_RIGHT" ]; then
  # Port-baserad mappning (rekommenderas, stabil även för identiska paneler).
  args=()
  [ -n "$TOUCH_PATH_LEFT" ]  && [ -n "$OUTPUT_LEFT" ]  && args+=("$TOUCH_PATH_LEFT"  "$OUTPUT_LEFT")
  [ -n "$TOUCH_PATH_RIGHT" ] && [ -n "$OUTPUT_RIGHT" ] && args+=("$TOUCH_PATH_RIGHT" "$OUTPUT_RIGHT")
  if [ "${#args[@]}" -ge 2 ]; then
    if [ "$WATCH" = 1 ]; then
      MAP_TOUCH_WATCH="${TOUCH_WATCH:-5}" MAP_TOUCH_DELAY=5 exec bash "$HERE/map-touch.sh" "${args[@]}"
    fi
    MAP_TOUCH_WATCH=0 MAP_TOUCH_DELAY=0 bash "$HERE/map-touch.sh" "${args[@]}"; rc=$?
  else
    echo "TOUCH_PATH_* satt men OUTPUT_* saknas i kiosk.env." >&2; rc=2
  fi
elif [ -n "$TOUCH_LEFT" ] || [ -n "$TOUCH_RIGHT" ]; then
  # Namn-baserad mappning (olika panelnamn).
  [ -n "$TOUCH_LEFT" ]  && [ -n "$OUTPUT_LEFT" ]  && xinput map-to-output "$TOUCH_LEFT"  "$OUTPUT_LEFT"  || true
  [ -n "$TOUCH_RIGHT" ] && [ -n "$OUTPUT_RIGHT" ] && xinput map-to-output "$TOUCH_RIGHT" "$OUTPUT_RIGHT" || true
else
  notify "Ingen touch-config i kiosk.env"
  echo "Sätt TOUCH_PATH_LEFT/RIGHT + OUTPUT_LEFT/RIGHT i deploy/nuc/kiosk.env." >&2
  echo "Kör  bash deploy/nuc/find-touch.sh  — den skriver ut raderna åt dig." >&2
  done_close; exit 1
fi

if [ "$rc" -eq 0 ]; then
  notify "Touch ommappad ✓"; echo "Touch ommappad."
else
  notify "Touch-mappning misslyckades"; echo "Något gick fel (se ovan)." >&2
fi
done_close
exit "$rc"
