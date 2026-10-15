#!/usr/bin/env bash
# Delad hjälp för kiosk.sh / start.sh / restart.sh / update.sh.
# SOURCEAS (körs inte själv):   . "$(dirname "$0")/_common.sh"
#
# Innehåller: städad inläsning av kiosk.env, notiser, och start/stopp av kiosken.

NUC_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd "$NUC_DIR/../.." && pwd)"

# Läs kiosk.env, men städa först bort CR (Windows-radslut) och icke-brytbara
# blanksteg (U+00A0) — de smyger sig in när man klistrar från chatt/webb och ger
# annars "command not found". Original-filen ändras inte.
load_kiosk_env() {
  local f="$NUC_DIR/kiosk.env" txt tmp
  [ -f "$f" ] || return 0
  txt="$(<"$f")"
  txt="${txt//$'\r'/}"
  txt="${txt//$'\xc2\xa0'/ }"
  # Via tempfil (inte `. <(...)`): fungerar i alla bash-versioner.
  tmp="$(mktemp)"
  printf '%s\n' "$txt" > "$tmp"
  # shellcheck disable=SC1090
  . "$tmp"
  rm -f "$tmp"
}

# Läs konfig + sätt de variabler som start/stopp behöver.
kiosk_init() {
  load_kiosk_env
  URL_BASE="${URL_BASE:-http://localhost:8080}"
  PROFILE_DIR="${PROFILE_DIR:-$HOME/.forhandlingen-kiosk}"
  VALV="${VALV:-both}"           # both | syd | nord  (syd/nord = bara ett fönster, för test med en skärm)
  LOG_FILE="$PROFILE_DIR/kiosk.log"
  mkdir -p "$PROFILE_DIR"
}

# Skrivbordsnotis om möjligt (annars tyst).
notify() {
  command -v notify-send >/dev/null 2>&1 && notify-send -t 4000 "Förhandlingen" "$1" 2>/dev/null || true
}

# Vilka valv ska köra? ("syd nord" / "syd" / "nord")
expected_valv() {
  case "$VALV" in
    syd)  echo "syd" ;;
    nord) echo "nord" ;;
    *)    echo "syd nord" ;;
  esac
}

# Kör webbläsarfönstret för ett valv (syd|nord)?  Matchar på profilmappen.
valv_running() {
  pgrep -f -- "--user-data-dir=$PROFILE_DIR/$1" >/dev/null 2>&1
}

# Kör ALLA förväntade valv?
all_valv_running() {
  local v
  for v in $(expected_valv); do valv_running "$v" || return 1; done
  return 0
}

# Kör något av kioskens fönster?
any_valv_running() {
  pgrep -f -- "--user-data-dir=$PROFILE_DIR/" >/dev/null 2>&1
}

# Är kiosken installerad som systemd user-tjänst (install.sh utan --server-only)?
# Då måste vi gå via tjänsten, annars startar den om fönstren bakom ryggen på oss.
kiosk_service_enabled() {
  command -v systemctl >/dev/null 2>&1 \
    && systemctl --user is-enabled forhandlingen-kiosk.service >/dev/null 2>&1
}

# Stoppa kiosken: kiosk.sh, touch-watch och ALLA kiosk-fönster. Rör BARA vår egen
# profil (--user-data-dir=$PROFILE_DIR/...), så annan Chrome-användning lever vidare.
stop_kiosk() {
  local i
  if kiosk_service_enabled; then
    systemctl --user stop forhandlingen-kiosk.service 2>/dev/null || true
  fi
  pkill -f -- "$NUC_DIR/kiosk.sh" 2>/dev/null || true
  pkill -f -- "$NUC_DIR/map-touch.sh" 2>/dev/null || true
  pkill -TERM -f -- "--user-data-dir=$PROFILE_DIR/" 2>/dev/null || true
  for i in 1 2 3 4 5 6 7 8 9 10; do
    any_valv_running || return 0
    sleep 0.5
  done
  # Envisa processer: slå ut dem hårt.
  pkill -KILL -f -- "--user-data-dir=$PROFILE_DIR/" 2>/dev/null || true
  sleep 1
  return 0
}

# Starta kiosken i bakgrunden, fristående från den här terminalen/knappen.
start_kiosk() {
  if kiosk_service_enabled; then
    systemctl --user start forhandlingen-kiosk.service
    return $?
  fi
  {
    echo
    echo "=== $(date '+%Y-%m-%d %H:%M:%S') start ==="
  } >>"$LOG_FILE" 2>/dev/null || true
  if command -v setsid >/dev/null 2>&1; then
    setsid bash "$NUC_DIR/kiosk.sh" >>"$LOG_FILE" 2>&1 </dev/null &
  else
    nohup bash "$NUC_DIR/kiosk.sh" >>"$LOG_FILE" 2>&1 </dev/null &
  fi
  disown 2>/dev/null || true
  return 0
}

# Vänta tills ALLA förväntade kiosk-fönster faktiskt finns (max $1 sekunder,
# default 30). Fångar fallet "start.sh sa Startar men kiosk.sh dog direkt"
# (t.ex. ingen webbläsare hittad). Vid miss: skriv ut loggens svans + notis.
verify_windows_started() {
  local max="${1:-30}" i
  for i in $(seq 1 "$max"); do
    all_valv_running && return 0
    sleep 1
  done
  notify "FEL: skärmarna startade inte. Logg: $LOG_FILE"
  echo "FEL: kiosk-fönstren startade inte inom ${max}s. Sista raderna i $LOG_FILE:" >&2
  tail -n 15 "$LOG_FILE" >&2 2>/dev/null || true
  return 1
}

# Vänta på att servern svarar (max $1 sekunder, default 30). 0 = svarar.
wait_for_server() {
  local max="${1:-30}" i
  for i in $(seq 1 "$max"); do
    curl -fsS --max-time 2 "$URL_BASE/healthz" >/dev/null 2>&1 && return 0
    sleep 1
  done
  return 1
}
