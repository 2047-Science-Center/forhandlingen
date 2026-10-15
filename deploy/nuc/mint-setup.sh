#!/usr/bin/env bash
# =============================================================================
# Förhandlingen på LINUX MINT (Cinnamon, X11) — förberedelse av testnuc/NUC.
#
# Kör EFTER att du klonat repot och kört  deploy/nuc/install.sh --server-only
# (se deploy/nuc/MINT.md, steg för steg). Skriptet gör Mint-delarna:
#   1. kontrollerar att du sitter i X11 (Cinnamon), inte Wayland
#   2. installerar paket (xinput, pactl, notify-send, ...)  [hoppa över: --no-apt]
#   3. kontrollerar Node 20+ och en webbläsare (installerar dem INTE — skriver
#      ut exakta kommandon om något saknas)
#   4. stänger av skärmsläckare/lås/strömsparläge i Cinnamon  [hoppa över: --no-power]
#   5. skapar kiosk.env (om saknas) och lägger ikonerna
#      Starta / Starta om / Uppdatera på skrivbordet (install-launcher.sh)
#   6. valfritt:  --autostart  starta spelet automatiskt vid inloggning
#                 --autologin  LightDM loggar in automatiskt (kräver sudo)
#
# Kör som din vanliga användare (INTE sudo):   bash deploy/nuc/mint-setup.sh
# Skriptet frågar själv efter sudo-lösenord där det behövs. Inga lösenord eller
# hemligheter skrivs till någon fil.
# Säkert att köra om.
# =============================================================================
set -u

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
USER_NAME="$(id -un)"

DO_APT=1; DO_POWER=1; DO_AUTOSTART=0; DO_AUTOLOGIN=0
for a in "$@"; do
  case "$a" in
    --no-apt)    DO_APT=0 ;;
    --no-power)  DO_POWER=0 ;;
    --autostart) DO_AUTOSTART=1 ;;
    --autologin) DO_AUTOLOGIN=1 ;;
    -h|--help)   sed -n '2,22p' "${BASH_SOURCE[0]}"; exit 0 ;;
    *) echo "Okänd flagga: $a   (se --help)" >&2; exit 1 ;;
  esac
done

if [ "$USER_NAME" = "root" ]; then
  echo "Kör INTE som root/sudo — kör som din vanliga användare." >&2
  exit 1
fi

say()  { printf '\n\033[1;33m== %s\033[0m\n' "$*"; }
ok()   { printf '  \033[32mOK\033[0m   %s\n' "$*"; }
warn() { printf '  \033[33m!!\033[0m   %s\n' "$*"; TODO=$((TODO + 1)); }
TODO=0

# ---------------------------------------------------------------------------
say "1/6  Kontrollerar system och session"
OS_ID=""; OS_NAME=""
if [ -r /etc/os-release ]; then
  OS_ID="$(. /etc/os-release; echo "${ID:-}")"
  OS_NAME="$(. /etc/os-release; echo "${PRETTY_NAME:-}")"
fi
if [ "$OS_ID" = "linuxmint" ]; then
  ok "Linux Mint ($OS_NAME)"
else
  warn "Inte Linux Mint ($OS_NAME) — skriptet är skrivet för Mint men funkar oftast på Ubuntu/Debian med LightDM."
fi

SESSION="${XDG_SESSION_TYPE:-okänd}"
if [ "$SESSION" = "x11" ]; then
  ok "X11-session (${XDG_CURRENT_DESKTOP:-?})"
elif [ "$SESSION" = "wayland" ]; then
  warn "Du sitter i en WAYLAND-session. Touch-mappning funkar inte. Logga ut och välj sessionen 'Cinnamon' (inte 'Cinnamon on Wayland') via kugghjulet vid inloggningen."
else
  warn "Kunde inte avgöra sessionstyp (XDG_SESSION_TYPE='$SESSION'). Kör detta i en vanlig terminal på skrivbordet, inte över SSH."
fi

# ---------------------------------------------------------------------------
say "2/6  Paket"
if [ "$DO_APT" = 1 ]; then
  if command -v apt >/dev/null 2>&1; then
    # xinput + libinput: touch→skärm-mappning. x11-xserver-utils: xrandr/xset.
    # pulseaudio-utils: pactl (ljud per valv; funkar även med PipeWire).
    # libnotify-bin: notiser. git/curl/python3: uppdatering, hälsokoll, ljud-routing.
    if sudo apt update && sudo apt install -y \
         git curl python3 xinput xserver-xorg-input-libinput x11-xserver-utils \
         pulseaudio-utils libnotify-bin xdg-utils libglib2.0-bin; then
      ok "paket installerade"
    else
      warn "apt misslyckades (nät/DNS?). Kör om:  bash deploy/nuc/mint-setup.sh"
    fi
  else
    warn "apt saknas — hoppar över paketsteget."
  fi
else
  ok "hoppar över apt (--no-apt)"
fi

# ---------------------------------------------------------------------------
say "3/6  Node och webbläsare"
if command -v node >/dev/null 2>&1; then
  NODE_MAJOR="$(node -p 'process.versions.node.split(".")[0]' 2>/dev/null || echo 0)"
  if [ "$NODE_MAJOR" -ge 20 ] 2>/dev/null; then
    ok "Node $(node -v)"
  else
    warn "Node $(node -v) är för gammal (Mints apt-nodejs är ofta 18). Installera Node 20+:"
    echo "        curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -"
    echo "        sudo apt install -y nodejs"
  fi
else
  warn "Node saknas. Installera Node 20+:"
  echo "        curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -"
  echo "        sudo apt install -y nodejs"
fi

BROWSER_FOUND=""
for b in google-chrome-stable google-chrome chromium-browser chromium; do
  if command -v "$b" >/dev/null 2>&1; then BROWSER_FOUND="$b"; break; fi
done
if [ -n "$BROWSER_FOUND" ]; then
  RESOLVED="$(readlink -f "$(command -v "$BROWSER_FOUND")" 2>/dev/null || true)"
  case "$RESOLVED" in
    /snap/*|*/snap/*) warn "$BROWSER_FOUND är en SNAP-version — den struntar i ljud per valv. Installera Google Chrome (.deb), se MINT.md." ;;
    *) ok "webbläsare: $BROWSER_FOUND ($RESOLVED)" ;;
  esac
else
  warn "Ingen Chrome/Chromium hittades. Enklast på Mint (riktig deb, ingen snap):"
  echo "        sudo apt install -y chromium"
  echo "     eller Google Chrome (.deb, bäst för ljud per valv): se MINT.md."
fi

# ---------------------------------------------------------------------------
say "4/6  Skärmsläckare / lås / strömsparläge (Cinnamon)"
gset() {  # gset <schema> <key> <value> — hoppar tyst över nycklar som inte finns
  gsettings list-keys "$1" 2>/dev/null | grep -qx "$2" || return 0
  gsettings set "$1" "$2" "$3" 2>/dev/null
}
if [ "$DO_POWER" = 0 ]; then
  ok "hoppar över (--no-power)"
elif ! command -v gsettings >/dev/null 2>&1; then
  warn "gsettings saknas — ställ in 'ingen skärmsläckare/lås/strömspar' för hand (Meny → Strömhantering / Skärmsläckare)."
elif [ -z "${DBUS_SESSION_BUS_ADDRESS:-}" ]; then
  warn "Ingen dbus-session (kör du över SSH?). Kör om detta skript i en terminal på själva skrivbordet."
else
  gset org.cinnamon.desktop.screensaver lock-enabled false
  gset org.cinnamon.desktop.session idle-delay 0
  gset org.cinnamon.settings-daemon.plugins.power sleep-display-ac 0
  gset org.cinnamon.settings-daemon.plugins.power sleep-display-battery 0
  gset org.cinnamon.settings-daemon.plugins.power sleep-inactive-ac-timeout 0
  gset org.cinnamon.settings-daemon.plugins.power sleep-inactive-battery-timeout 0
  gset org.cinnamon.settings-daemon.plugins.power lock-on-suspend false
  ok "skärmsläckare, lås och strömsparläge avstängt (Cinnamon)"
fi

# ---------------------------------------------------------------------------
say "5/6  Skripten, kiosk.env och skrivbordsikoner"
chmod +x "$HERE"/*.sh
ok "skripten körbara"
if [ ! -f "$HERE/kiosk.env" ]; then
  cp "$HERE/kiosk.env.example" "$HERE/kiosk.env"
  ok "skapade kiosk.env (alla rader utkommenterade = defaults)"
else
  ok "kiosk.env finns redan — rörs inte"
fi
if bash "$HERE/install-launcher.sh"; then
  ok "ikoner installerade (se utskriften ovan för eventuella anmärkningar)"
else
  warn "install-launcher.sh misslyckades — kör den för hand:  bash deploy/nuc/install-launcher.sh"
fi

# ---------------------------------------------------------------------------
say "6/6  Valfritt: autostart och autologin"
if [ "$DO_AUTOSTART" = 1 ]; then
  mkdir -p "$HOME/.config/autostart"
  cat > "$HOME/.config/autostart/forhandlingen-start.desktop" <<EOF
[Desktop Entry]
Type=Application
Name=Förhandlingen (autostart)
Comment=Startar stationen när skrivbordet är uppe
Exec=bash "$HERE/start.sh"
Terminal=false
X-GNOME-Autostart-enabled=true
X-GNOME-Autostart-Delay=8
EOF
  ok "autostart: ~/.config/autostart/forhandlingen-start.desktop (8 s fördröjning)"
  echo "     Ångra:  rm ~/.config/autostart/forhandlingen-start.desktop"
else
  echo "  (hoppar över autostart — lägg till med  --autostart)"
fi

if [ "$DO_AUTOLOGIN" = 1 ]; then
  if [ ! -f /usr/share/xsessions/cinnamon.desktop ]; then
    warn "Hittar inte /usr/share/xsessions/cinnamon.desktop — hoppar över autologin. Slå på det i Meny → Inloggningsfönster → Användare."
  elif ! command -v lightdm >/dev/null 2>&1; then
    warn "LightDM saknas (annan inloggningshanterare?) — hoppar över autologin."
  else
    # Drop-in som läses SIST (90-) och därför vinner över Mints egna 70-linuxmint.conf.
    CONF=/etc/lightdm/lightdm.conf.d/90-forhandlingen-autologin.conf
    sudo mkdir -p /etc/lightdm/lightdm.conf.d
    if sudo tee "$CONF" >/dev/null <<EOF
[Seat:*]
autologin-user=$USER_NAME
autologin-user-timeout=0
autologin-session=cinnamon
EOF
    then
      ok "autologin till X11-sessionen 'cinnamon' för $USER_NAME  ($CONF)"
      echo "     Ångra:  sudo rm $CONF   (+ starta om)"
    else
      warn "kunde inte skriva $CONF"
    fi
  fi
else
  echo "  (hoppar över autologin — lägg till med  --autologin, eller Meny → Inloggningsfönster)"
fi

# ---------------------------------------------------------------------------
say "KLART"
if [ "$TODO" -gt 0 ]; then
  printf '\033[1;33m%s punkt(er) markerade med !! ovan behöver åtgärdas.\033[0m\n' "$TODO"
fi
cat <<EOF

Nästa steg (se deploy/nuc/MINT.md):
  1. Kontrollera allt:         bash deploy/nuc/mint-check.sh
  2. (touch) Hitta paneler:    bash deploy/nuc/find-touch.sh   -> klistra i kiosk.env
  3. Starta:                   dubbelklicka 'Starta Förhandlingen' på skrivbordet
EOF
exit 0
