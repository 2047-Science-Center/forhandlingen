#!/usr/bin/env bash
# find-touch.sh — Hitta touchpanelernas USB-port (ID_PATH) och dina skärmar, och
# skriv ut färdiga rader att klistra in i kiosk.env. Rör INGET på maskinen.
#
# Kör med skärmarna OCH touchpanelerna inkopplade, i en X11-session:
#     bash deploy/nuc/find-touch.sh
# Anpassad från mint-touchstation-bas/find-touch.sh (minnestest-repot).
set -u

if ! command -v xinput >/dev/null 2>&1; then
  echo "xinput saknas. Kör  bash deploy/nuc/mint-setup.sh  (eller: sudo apt install xinput)." >&2
  exit 1
fi

echo "=================================================================="
echo " SKÄRMAR  (xrandr --listmonitors)"
echo "=================================================================="
if command -v xrandr >/dev/null 2>&1; then
  xrandr --listmonitors | sed '1d' | while read -r idx name rest; do
    geom="$(echo "$rest" | grep -oE '[0-9]+/[0-9]+x[0-9]+/[0-9]+\+-?[0-9]+\+-?[0-9]+' | head -1)"
    pos="$(echo "$geom" | grep -oE '\+-?[0-9]+\+-?[0-9]+$')"
    printf "  %-10s  position %s\n" "${name#+}" "${pos:-?}"
  done
  echo
  echo "  (position +0+0 = längst till vänster; större +X = längre åt höger)"
else
  echo "  xrandr saknas."
fi

echo
echo "=================================================================="
echo " TOUCHPANELER  (namn + fysisk USB-port = ID_PATH)"
echo "=================================================================="
found=0
for id in $(xinput list --id-only 2>/dev/null); do
  name="$(xinput list --name-only "$id" 2>/dev/null)"
  # Bara pekdon/touch — hoppa över tangentbord, styrplattor, virtuella enheter.
  echo "$name" | grep -qiE 'touch|pen|panel|cooltouch|hi-tech|weida' || continue
  node="$(xinput list-props "$id" 2>/dev/null | sed -n 's/.*Device Node[^"]*"\([^"]*\)".*/\1/p')"
  [ -n "$node" ] || continue
  path="$(udevadm info -q property "$node" 2>/dev/null | sed -n 's/^ID_PATH=//p')"
  [ -n "$path" ] || continue
  found=1
  printf "  panel: %-30s  (xinput id %s)\n" "$name" "$id"
  printf "    ID_PATH = %s\n\n" "$path"
done

if [ "$found" = 0 ]; then
  echo "  Hittade ingen touchpanel. Är de inkopplade? Sitter du i en X11-session?"
  echo "  (Kolla: echo \$XDG_SESSION_TYPE  ->  ska säga 'x11', inte 'wayland'.)"
  exit 1
fi

echo "=================================================================="
echo " KLISTRA IN I deploy/nuc/kiosk.env   (öppna med:  nano deploy/nuc/kiosk.env)"
echo "=================================================================="
echo "  Para ihop varje ID_PATH ovan med rätt SKÄRM (vänster panel -> vänster skärm):"
echo
echo '    TOUCH_PATH_LEFT="<ID_PATH för vänster panel>"   ; OUTPUT_LEFT=<skärmnamn vänster>'
echo '    TOUCH_PATH_RIGHT="<ID_PATH för höger panel>"    ; OUTPUT_RIGHT=<skärmnamn höger>'
echo '    TOUCH_WATCH=5'
echo
echo "  Vet du inte vilken panel som är vilken? Gissa, starta om spelet"
echo "  (ikonen 'Starta om Förhandlingen'), tryck på en skärm — hamnar pekaren"
echo "  på fel skärm, byt plats på de två ID_PATH-raderna."
echo "  TOUCH_WATCH=5 = självläkande: mappningen läggs om var 5:e sekund."
