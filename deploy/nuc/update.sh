#!/usr/bin/env bash
# UPPDATERA SPELET — hämta senaste koden, bygg om och ladda om stationen.
# Mål för ikonen "Uppdatera Förhandlingen" (körs i en terminal så man ser vad
# som händer). Kan också köras för hand:  bash deploy/nuc/update.sh
#
# Flaggor:
#   --force   bygg om och starta om även om inget nytt hämtades
#
# Säkert: bygget görs i en tillfällig mapp (dist.next) och byts in först när det
# lyckats — misslyckas bygget kör spelet vidare på den gamla versionen.
# Servern läser dist/ vid varje anrop, så ny build syns direkt; server-tjänsten
# startas bara om när server/ eller beroenden ändrats (frågar då om sudo-lösenord).
set -u

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
. "$HERE/_common.sh"
kiosk_init

FORCE=0
for a in "$@"; do
  case "$a" in
    --force) FORCE=1 ;;
    *) echo "Okänd flagga: $a" >&2; exit 1 ;;
  esac
done

pause() { [ -t 1 ] && read -rp "Tryck Enter för att stänga..."; return 0; }
fail()  { echo; echo "STOPP: $1"; notify "Uppdateringen misslyckades: $1"; pause; exit 1; }

cd "$REPO_DIR" || fail "Hittar inte repot ($REPO_DIR)"
command -v git >/dev/null 2>&1 || fail "git saknas"
command -v npm >/dev/null 2>&1 || fail "npm saknas (installera Node 20+)"

BRANCH="$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo '?')"
echo "== Hämtar senaste (git pull) — gren: $BRANCH =="
if ! git pull --ff-only; then
  echo
  echo "git pull misslyckades. Vanliga orsaker: inget nät, eller lokala ändringar i repot."
  echo "Spelet körs vidare på nuvarande version (inget har ändrats)."
  fail "git pull misslyckades"
fi
AFTER="$(git rev-parse HEAD 2>/dev/null || echo none)"

# Vilken commit byggdes dist/ senast från? (skrivs av detta skript efter lyckat
# bygge). Då kan vi hoppa över när inget är nytt — men bygga om om ett tidigare
# bygge föll, även om git pull inte hämtade något nytt den här gången.
BUILT="$(cat "$REPO_DIR/dist/.built-commit" 2>/dev/null || true)"
if [ "$BUILT" = "$AFTER" ] && [ "$FORCE" = 0 ] && [ -f "$REPO_DIR/dist/index.html" ]; then
  echo
  echo "Redan senaste versionen ($(git log -1 --format='%h %s' | cut -c1-70))."
  echo "Hoppar över bygget. (Tvinga omstart + bygge med:  bash deploy/nuc/update.sh --force)"
  notify "Redan senaste versionen."
  pause
  exit 0
fi

# Vilka filer ändrades sedan senaste bygget? Okänt bygge (första uppdateringen,
# eller dist/ byggd av install.sh) => anta att allt ändrats (npm ci + server-omstart).
CHANGED_ALL=1; CHANGED=""
if [ -n "$BUILT" ] && git cat-file -e "$BUILT^{commit}" 2>/dev/null; then
  CHANGED="$(git diff --name-only "$BUILT" "$AFTER" 2>/dev/null || true)"
  CHANGED_ALL=0
fi
changed() { [ "$CHANGED_ALL" = 1 ] && return 0; printf '%s\n' "$CHANGED" | grep -Eq "$1"; }

if [ "$FORCE" = 1 ] || [ ! -d "$REPO_DIR/node_modules" ] || changed '^package(-lock)?\.json$'; then
  echo; echo "== Installerar beroenden (npm ci) =="
  npm ci || npm install || fail "npm install misslyckades"
fi

echo; echo "== Bygger ny version (npm run build:relay) =="
rm -rf "$REPO_DIR/dist.next" "$REPO_DIR/dist.old"
if ! npm run build:relay -- --outDir dist.next; then
  rm -rf "$REPO_DIR/dist.next"
  echo "Bygget misslyckades — spelet körs vidare på den gamla versionen."
  fail "bygget misslyckades"
fi
[ -f "$REPO_DIR/dist.next/index.html" ] || { rm -rf "$REPO_DIR/dist.next"; fail "bygget gav ingen index.html"; }
echo "$AFTER" > "$REPO_DIR/dist.next/.built-commit"

# Byt in (två snabba mv). Servern läser filer per anrop → ingen driftstopp.
[ -d "$REPO_DIR/dist" ] && mv "$REPO_DIR/dist" "$REPO_DIR/dist.old"
mv "$REPO_DIR/dist.next" "$REPO_DIR/dist"
rm -rf "$REPO_DIR/dist.old"
echo "Ny build på plats."

# Servern behöver bara startas om om dess egen kod / beroenden ändrats.
if [ "$FORCE" = 1 ] || changed '^server/' || changed '^package(-lock)?\.json$'; then
  if systemctl cat forhandlingen-server.service >/dev/null 2>&1; then
    echo; echo "== Startar om server-tjänsten (sudo — skriv lösenordet om det frågas) =="
    sudo systemctl restart forhandlingen-server.service || echo "Varning: kunde inte starta om servern." >&2
  fi
fi

echo; echo "== Laddar om stationen =="
if ! wait_for_server 30; then
  echo "Varning: servern svarar inte på $URL_BASE/healthz — kolla: sudo systemctl status forhandlingen-server" >&2
fi
stop_kiosk
sleep 1
start_kiosk

VER="$(git log -1 --format='%h %s' | cut -c1-70)"
echo
echo "Klart! Förhandlingen är uppdaterad och startas om på panelerna."
echo "Version: $VER"
notify "Uppdaterad: $VER"
pause
