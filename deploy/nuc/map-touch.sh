#!/usr/bin/env bash
# Mappa touchpaneler till rätt skärm via deras fysiska USB-port (ID_PATH).
# Binds till porten, inte till xinput-id → håller över omstart även för
# IDENTISKA paneler (samma namn, där id kan byta plats mellan boots).
#
# Kräver X11 (Wayland stöder inte map-to-output).
#
# Användning (par av ID_PATH + skärmnamn):
#   map-touch.sh <ID_PATH> <OUTPUT> [<ID_PATH> <OUTPUT> ...]
# Ex:
#   map-touch.sh pci-0000:00:14.0-usb-0:3:1.0 DP-1 pci-0000:00:14.0-usb-0:1:1.0 DP-3
#
# ID_PATH hittas så här (för varje touch-enhet i `xinput list`):
#   node=$(xinput list-props <id> | sed -n 's/.*Device Node[^"]*"\([^"]*\)".*/\1/p')
#   udevadm info -q property "$node" | grep ID_PATH
#
# Valfri fördröjning innan mappning (t.ex. vid autostart): MAP_TOUCH_DELAY=5

[ "${MAP_TOUCH_DELAY:-0}" -gt 0 ] 2>/dev/null && sleep "${MAP_TOUCH_DELAY}"

map_one() {
  want="$1"
  output="$2"
  for id in $(xinput list --id-only 2>/dev/null); do
    node=$(xinput list-props "$id" 2>/dev/null | sed -n 's/.*Device Node[^"]*"\([^"]*\)".*/\1/p')
    [ -n "$node" ] || continue
    path=$(udevadm info -q property "$node" 2>/dev/null | sed -n 's/^ID_PATH=//p')
    if [ "$path" = "$want" ]; then
      if xinput map-to-output "$id" "$output"; then
        echo "map-touch: $want -> $output (id $id)"
      fi
      return 0
    fi
  done
  echo "map-touch: hittade ingen enhet på USB-port $want" >&2
}

while [ "$#" -ge 2 ]; do
  map_one "$1" "$2"
  shift 2
done
