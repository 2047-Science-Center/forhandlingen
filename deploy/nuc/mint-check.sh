#!/usr/bin/env bash
# mint-check.sh — kontrollerar att testnucen/NUC:en är redo för Förhandlingen.
# LÄSANDE: ändrar ingenting av betydelse (skapar bara en tom loggmapp
# ~/.forhandlingen-kiosk), kräver inte sudo. Kör i en terminal på själva
# skrivbordet:   bash deploy/nuc/mint-check.sh
#
# Rader:  OK = bra   |  !! = åtgärda   |  .. = info / kan inte avgöras härifrån
# Avslutskod = antal !! (0 = allt grönt).
set -u

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
. "$HERE/_common.sh"
kiosk_init

FAILS=0
ok()   { printf '  \033[32mOK\033[0m  %s\n' "$*"; }
bad()  { printf '  \033[31m!!\033[0m  %s\n' "$*"; FAILS=$((FAILS + 1)); }
info() { printf '  ..  %s\n' "$*"; }
head1() { printf '\n\033[1m%s\033[0m\n' "$*"; }

head1 "System och session"
OS_PRETTY=""; OS_ID=""
if [ -r /etc/os-release ]; then
  OS_PRETTY="$(. /etc/os-release; echo "${PRETTY_NAME:-}")"
  OS_ID="$(. /etc/os-release; echo "${ID:-}")"
fi
if [ "$OS_ID" = "linuxmint" ]; then ok "Linux Mint: $OS_PRETTY"; else info "OS: ${OS_PRETTY:-okänt} (inte Mint)"; fi
case "${XDG_SESSION_TYPE:-}" in
  x11)     ok "session: X11 (${XDG_CURRENT_DESKTOP:-?})" ;;
  wayland) bad "session: WAYLAND — välj 'Cinnamon' (inte 'Cinnamon on Wayland') vid inloggning" ;;
  *)       bad "session: okänd (XDG_SESSION_TYPE='${XDG_SESSION_TYPE:-}') — kör detta i en terminal på skrivbordet, inte via SSH" ;;
esac
DM="$(basename "$(cat /etc/X11/default-display-manager 2>/dev/null)" 2>/dev/null || true)"
if [ "$DM" = "lightdm" ]; then ok "inloggningshanterare: LightDM"; else info "inloggningshanterare: ${DM:-okänd}"; fi
# Autologin-konfig (läsbar utan sudo).
AL="$(grep -hs '^autologin-user=' /etc/lightdm/lightdm.conf /etc/lightdm/lightdm.conf.d/*.conf 2>/dev/null | tail -1)"
if [ -n "$AL" ]; then ok "LightDM autologin: $AL"; else info "LightDM autologin: ej inställt (slå på via mint-setup.sh --autologin eller Meny → Inloggningsfönster)"; fi
ASS="$(grep -hs '^autologin-session=' /etc/lightdm/lightdm.conf /etc/lightdm/lightdm.conf.d/*.conf 2>/dev/null | tail -1)"
case "$ASS" in
  *wayland*) bad "autologin-session pekar på Wayland: $ASS" ;;
  "")        : ;;
  *)         ok "autologin-session: $ASS" ;;
esac

head1 "Verktyg"
for c in git curl python3 xinput xrandr pactl notify-send gio setsid; do
  if command -v "$c" >/dev/null 2>&1; then ok "$c"; else bad "$c saknas  (bash deploy/nuc/mint-setup.sh installerar)"; fi
done
if command -v node >/dev/null 2>&1; then
  NM="$(node -p 'process.versions.node.split(".")[0]' 2>/dev/null || echo 0)"
  if [ "$NM" -ge 20 ] 2>/dev/null; then ok "node $(node -v)"; else bad "node $(node -v) < 20 (se MINT.md, NodeSource)"; fi
else
  bad "node saknas"
fi

head1 "Webbläsare"
B="${BROWSER_BIN:-}"
if [ -z "$B" ]; then
  for b in google-chrome-stable google-chrome chromium-browser chromium; do
    if command -v "$b" >/dev/null 2>&1; then B="$b"; break; fi
  done
fi
if [ -z "$B" ]; then
  bad "ingen Chrome/Chromium hittad"
else
  R="$(readlink -f "$(command -v "$B" 2>/dev/null || echo "$B")" 2>/dev/null || true)"
  case "$R" in
    /snap/*|*/snap/*) bad "$B är SNAP ($R) — ljud per valv fungerar inte. Installera Google Chrome (.deb)." ;;
    *)                ok  "$B ($R)" ;;
  esac
  case "$B" in
    google-chrome*) ok "Google Chrome (bäst för ljud per valv)" ;;
    *) info "inte Google Chrome — ljud per valv: verifiera på plats" ;;
  esac
fi

head1 "Server och build"
if [ -f "$REPO_DIR/dist/index.html" ]; then ok "dist/ finns (appen är byggd)"; else bad "dist/ saknas — kör  deploy/nuc/install.sh --server-only"; fi
if command -v systemctl >/dev/null 2>&1; then
  if systemctl is-active --quiet forhandlingen-server.service 2>/dev/null; then ok "forhandlingen-server (systemd) kör"; else bad "forhandlingen-server kör inte  (sudo systemctl status forhandlingen-server)"; fi
  if systemctl is-enabled --quiet forhandlingen-server.service 2>/dev/null; then ok "forhandlingen-server startar vid boot"; else bad "forhandlingen-server är inte enabled"; fi
fi
if curl -fsS --max-time 3 "$URL_BASE/healthz" >/dev/null 2>&1; then ok "$URL_BASE/healthz svarar"; else bad "$URL_BASE/healthz svarar inte"; fi
if kiosk_service_enabled; then info "OBS: systemd-user-tjänsten forhandlingen-kiosk är enabled (install.sh utan --server-only). På Mint rekommenderas --server-only + ikonerna; tjänsten och autostart kan krocka."; fi

head1 "Skärmar"
if command -v xrandr >/dev/null 2>&1 && [ -n "${DISPLAY:-}" ]; then
  MON="$(xrandr --listmonitors 2>/dev/null)"
  echo "$MON" | sed 's/^/        /'
  N="$(echo "$MON" | head -1 | awk '{print $2}')"
  if [ "${N:-0}" -ge 2 ] 2>/dev/null; then ok "$N skärmar"; else info "bara ${N:-0} skärm — testa med  VALV=syd  i kiosk.env"; fi
else
  info "xrandr/DISPLAY saknas — kan inte lista skärmar"
fi

head1 "Touch (information — mappningen avgörs på plats)"
if command -v xinput >/dev/null 2>&1 && [ -n "${DISPLAY:-}" ]; then
  T="$(xinput list --name-only 2>/dev/null | grep -iE 'touch|panel|pen|weida|hi-tech' || true)"
  if [ -n "$T" ]; then echo "$T" | sed 's/^/        /'; ok "touch-enheter hittade (kör find-touch.sh för portarna)"; else info "inga touch-enheter hittade (inte inkopplade?)"; fi
else
  info "xinput/DISPLAY saknas"
fi
if grep -qs '^[[:space:]]*TOUCH_PATH_\|^[[:space:]]*TOUCH_LEFT\|^[[:space:]]*TOUCH_RIGHT' "$HERE/kiosk.env" 2>/dev/null; then ok "touch-mappning inställd i kiosk.env"; else info "ingen touch-mappning i kiosk.env"; fi

head1 "Ljud per valv"
SL=""; SR=""
SL="${SINK_LEFT:-}"; SR="${SINK_RIGHT:-}"
if command -v pactl >/dev/null 2>&1; then
  pactl list short sinks 2>/dev/null | awk '{print "        " $2}'
  if [ -n "$SL" ] && [ -n "$SR" ]; then
    for s in "$SL" "$SR"; do
      if pactl list short sinks 2>/dev/null | awk '{print $2}' | grep -qx "$s"; then ok "sink finns: $s"; else bad "sink saknas: $s"; fi
    done
  else
    info "SINK_LEFT/SINK_RIGHT inte satta i kiosk.env (allt ljud på standardutgången)"
  fi
else
  info "pactl saknas"
fi

head1 "Ikoner och autostart"
DD="$(xdg-user-dir DESKTOP 2>/dev/null || echo "$HOME/Desktop")"
for n in forhandlingen forhandlingen-restart forhandlingen-update; do
  f="$DD/$n.desktop"
  if [ -f "$f" ]; then
    T="$(gio info -a metadata::trusted "$f" 2>/dev/null | sed -n 's/^ *metadata::trusted: *//p')"
    if [ -x "$f" ] && [ "$T" = "true" ]; then ok "$n.desktop (körbar + betrodd)"; else bad "$n.desktop: körbar=$([ -x "$f" ] && echo ja || echo nej) betrodd=${T:-nej} — kör install-launcher.sh / högerklicka → Tillåt start"; fi
  else
    bad "$f saknas — kör  bash deploy/nuc/install-launcher.sh"
  fi
done
if [ -f "$HOME/.config/autostart/forhandlingen-start.desktop" ]; then ok "autostart finns"; else info "autostart ej inställd (valfritt: mint-setup.sh --autostart)"; fi

head1 "Kiosken just nu"
if all_valv_running; then ok "kiosk-fönstren kör ($(expected_valv))"; elif any_valv_running; then bad "bara delar av kiosken kör"; else info "kiosken kör inte (starta via ikonen)"; fi
info "logg: $LOG_FILE"

echo
if [ "$FAILS" -eq 0 ]; then
  printf '\033[1;32mAllt grönt.\033[0m Kvar att verifiera på plats: touch, ljud per valv, autologin, omstart.\n'
else
  printf '\033[1;31m%s punkt(er) markerade !! behöver åtgärdas.\033[0m\n' "$FAILS"
fi
exit "$FAILS"
