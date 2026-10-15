#!/usr/bin/env bash
# STARTA OM — starta om spelet (kiosk-fönstren) UTAN att starta om datorn.
# Mål för ikonen "Starta om Förhandlingen". Tar ner Valv Syd + Valv Nord och
# startar dem på nytt. Rör bara kioskens egna Chrome/Chromium-fönster (egen
# --user-data-dir), inte annan webbläsning.
#
# Flaggor:
#   --server   starta även om server-tjänsten (kräver sudo; frågar efter
#              lösenord om du kör från en terminal). Behövs sällan.
#
# Obs: detta är INTE spelets egen "Starta om"-knapp (som nollställer
# spelomgången inne i appen). Det här är "stäng och öppna fönstren igen" — ta
# det om skärmarna hänger sig, är vita, eller hamnat fel.
set -u
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
. "$HERE/_common.sh"
kiosk_init

RESTART_SERVER=0
for a in "$@"; do
  case "$a" in
    --server) RESTART_SERVER=1 ;;
    *) echo "Okänd flagga: $a" >&2; exit 1 ;;
  esac
done

echo "Stänger kiosken ..."
stop_kiosk

if [ "$RESTART_SERVER" = 1 ]; then
  echo "Startar om servern (sudo) ..."
  sudo systemctl restart forhandlingen-server.service || echo "Kunde inte starta om servern." >&2
fi

if ! wait_for_server 40; then
  notify "FEL: servern svarar inte på $URL_BASE."
  echo "FEL: $URL_BASE/healthz svarar inte. Kolla:  sudo systemctl status forhandlingen-server" >&2
  echo "$(date '+%F %T') restart.sh: servern svarade inte på $URL_BASE/healthz" >>"$LOG_FILE" 2>/dev/null || true
  [ -t 1 ] && read -rp "Tryck Enter för att stänga..."
  exit 1
fi

sleep 1
start_kiosk
notify "Förhandlingen startas om ..."
echo "Startar om ... (logg: $LOG_FILE)"
if verify_windows_started 40; then
  echo "Klart — skärmfönstren är uppe igen."
else
  [ -t 1 ] && read -rp "Tryck Enter för att stänga..."
  exit 1
fi
