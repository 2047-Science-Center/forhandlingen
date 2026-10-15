#!/usr/bin/env bash
# STARTKNAPPEN — starta Förhandlingen (Valv Syd + Valv Nord) från skrivbordet.
# Mål för ikonen "Starta Förhandlingen". Säker att dubbelklicka:
#   - kör redan båda fönstren  -> gör inget (visar bara en notis)
#   - kör bara ett / hänger    -> städar och startar rent
#   - kör inget                -> startar
# Servern (systemd-tjänsten forhandlingen-server) måste svara; annars får du ett
# tydligt felmeddelande i stället för två vita fönster.
set -u
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
. "$HERE/_common.sh"
kiosk_init

if all_valv_running; then
  notify "Är redan igång. Hänger något? Använd 'Starta om Förhandlingen'."
  echo "Förhandlingen kör redan."
  exit 0
fi

# Något kvarglömt (t.ex. bara ett fönster)? Rensa först så vi inte får dubletter.
if any_valv_running; then
  echo "Delvis igång — städar och startar om rent."
  stop_kiosk
fi

if ! wait_for_server 40; then
  notify "FEL: servern svarar inte på $URL_BASE. Se MINT.md (felsökning)."
  echo "FEL: $URL_BASE/healthz svarar inte. Kolla:  sudo systemctl status forhandlingen-server" >&2
  # Visa felet även när vi startades från en ikon utan terminal: skriv till loggen.
  echo "$(date '+%F %T') start.sh: servern svarade inte på $URL_BASE/healthz" >>"$LOG_FILE" 2>/dev/null || true
  exit 1
fi

start_kiosk
notify "Startar Förhandlingen ..."
echo "Startar ... (logg: $LOG_FILE)"
if verify_windows_started 40; then
  echo "Igång: skärmfönstren är uppe."
else
  [ -t 1 ] && read -rp "Tryck Enter för att stänga..."
  exit 1
fi
