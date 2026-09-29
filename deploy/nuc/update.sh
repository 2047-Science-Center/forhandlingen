#!/usr/bin/env bash
# Uppdatera Förhandlingen till senaste versionen: hämta kod, bygg om och
# starta om stationen. Tänkt att köras från en skrivbordsknapp (i terminal).
set -u

HERE="$(cd "$(dirname "$0")" && pwd)"
REPO="$(cd "$HERE/../.." && pwd)"
cd "$REPO" || { echo "Hittar inte repot ($REPO)"; [ -t 1 ] && read -rp "Enter..."; exit 1; }

pause() { [ -t 1 ] && read -rp "Tryck Enter för att stänga..."; }

echo "== Hämtar senaste (git pull) =="
if ! git pull; then
  echo; echo "git pull misslyckades (se ovan). Ofta pga lokala ändringar."
  pause; exit 1
fi

echo; echo "== Bygger om appen (npm run build:relay) =="
if ! npm run build:relay; then
  echo; echo "Bygget misslyckades (se ovan)."
  pause; exit 1
fi

echo; echo "== Startar om stationen =="
pkill -f chrom 2>/dev/null || true
pkill -f chrome 2>/dev/null || true
sleep 2
# setsid → kiosken lever kvar även när denna terminal stängs.
setsid bash "$HERE/kiosk.sh" >/tmp/kiosk.log 2>&1 &

echo; echo "✔ Klart! Förhandlingen är uppdaterad och startas om på panelerna."
pause
