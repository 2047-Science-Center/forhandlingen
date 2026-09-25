#!/usr/bin/env bash
# =============================================================================
# Förhandlingen — gör NUC:en till en ren Xorg-kiosk (utan GNOME/GDM-krångel).
#
# Varför: Ubuntus GNOME-session kör Wayland, där appen inte kan placera fönster
# på rätt skärm och där två oberoende möss (MPX) inte fungerar. Detta skript
# bootar i stället rakt in i en minimal Xorg-session (openbox) som kör de två
# kiosk-fönstren. Det är driftsäkert och rätt för en permanent station.
#
# Kör på NUC:en, i repo-roten:
#     cd ~/forhandlingen && git pull && bash deploy/nuc/setup-xorg.sh
# Sedan:  sudo reboot
#
# Kräver att servern redan är installerad (deploy/nuc/install.sh har körts).
# Återställ till vanligt skrivbord: se sista utskriften.
# =============================================================================
set -euo pipefail

say() { printf '\n\033[1;33m== %s\033[0m\n' "$*"; }

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
USER_NAME="$(id -un)"
HOME_DIR="$HOME"

if [ "$USER_NAME" = "root" ]; then
  echo "Kör INTE som root/sudo — kör som din vanliga användare: bash deploy/nuc/setup-xorg.sh" >&2
  exit 1
fi

# --- 1) Paket: Xorg-server, fönsterhanterare, input-verktyg, dbus, webbläsare -
say "Installerar Xorg + openbox + verktyg"
sudo apt update
# INTE "|| true": om detta misslyckas ska vi stanna INNAN vi rör GDM/autologin,
# annars bootar NUC:en in i en textkonsol utan X.
if ! sudo apt install -y --no-install-recommends \
  xserver-xorg xserver-xorg-core xserver-xorg-input-libinput xinit openbox \
  x11-xserver-utils xinput dbus-x11; then
  echo "FEL: kunde inte installera X-paketen. Åtgärda nätverk/apt och kör om skriptet." >&2
  exit 1
fi
# Tillåt att X startas från en konsol-login (annars: "Only console users are
# allowed to run the X server").
sudo tee /etc/X11/Xwrapper.config >/dev/null <<'EOF'
allowed_users=anybody
needs_root_rights=yes
EOF
# Webbläsare: använd den som redan finns, annars installera chromium.
if ! command -v chromium >/dev/null 2>&1 \
   && ! command -v chromium-browser >/dev/null 2>&1 \
   && ! command -v google-chrome >/dev/null 2>&1 \
   && ! command -v google-chrome-stable >/dev/null 2>&1; then
  sudo apt install -y chromium || sudo apt install -y chromium-browser || true
fi

# Kontrollera att det nödvändiga faktiskt finns innan vi ändrar boot-läget.
for bin in startx openbox Xorg; do
  command -v "$bin" >/dev/null 2>&1 || { echo "FEL: '$bin' saknas trots install — avbryter." >&2; exit 1; }
done
if ! command -v chromium >/dev/null 2>&1 && ! command -v chromium-browser >/dev/null 2>&1 \
   && ! command -v google-chrome >/dev/null 2>&1 && ! command -v google-chrome-stable >/dev/null 2>&1; then
  echo "FEL: ingen webbläsare (chromium) hittades — avbryter." >&2
  exit 1
fi

# --- 2) Stäng av GDM/grafisk inloggning — vi bootar in i vår egen X-session ---
say "Stänger av den grafiska inloggningen (GDM)"
sudo systemctl set-default multi-user.target
sudo systemctl disable gdm3 2>/dev/null || sudo systemctl disable gdm 2>/dev/null || true

# --- 3) Autologin på tty1 för denna användare ---
say "Autologin på tty1 för $USER_NAME"
sudo mkdir -p /etc/systemd/system/getty@tty1.service.d
sudo tee /etc/systemd/system/getty@tty1.service.d/override.conf >/dev/null <<EOF
[Service]
ExecStart=
ExecStart=-/sbin/agetty --autologin $USER_NAME --noclear %I \$TERM
EOF
sudo systemctl daemon-reload

# --- 4) Starta X automatiskt när tty1 loggar in ---
say "Startar X automatiskt vid inloggning på tty1"
PROFILE="$HOME_DIR/.bash_profile"
if ! grep -q 'FORHANDLINGEN-KIOSK-AUTOSTART' "$PROFILE" 2>/dev/null; then
  cat >> "$PROFILE" <<'EOF'

# FORHANDLINGEN-KIOSK-AUTOSTART
if [ -z "${DISPLAY:-}" ] && [ "$(tty)" = "/dev/tty1" ]; then
  exec startx
fi
EOF
fi

# --- 5) X-sessionen: openbox + kiosk-skriptet (via dbus-session) ---
say "Skriver ~/.xinitrc (openbox + skärmarrangering + kiosk)"
# Del 1 (variabler expanderas nu): bake in kiosk-skriptets absoluta väg.
cat > "$HOME_DIR/.xinitrc" <<XINITRC
#!/bin/sh
KIOSK="$HERE/kiosk.sh"
XINITRC
# Del 2 (citerad heredoc → allt $ blir literalt i den genererade filen).
cat >> "$HOME_DIR/.xinitrc" <<'XINITRC'
# Ingen skärmsläckning / strömsparläge på skärmarna.
xset s off -dpms
xset s noblank
# Arrangera de två skärmarna sida vid sida (vänster = primär, höger till höger om).
# Sätter också SCREEN_W = vänsterskärmens bredd så höger fönster hamnar rätt.
OUTS=$(xrandr --query 2>/dev/null | awk '/ connected/{print $1}')
set -- $OUTS
if [ $# -ge 2 ]; then
  xrandr --output "$1" --auto --pos 0x0 --primary --output "$2" --auto --right-of "$1" || true
  LW=$(xrandr --query 2>/dev/null | awk -v o="$1" '$1==o{for(i=1;i<=NF;i++) if($i ~ /^[0-9]+x[0-9]+\+0\+0$/){split($i,a,"x"); print a[1]; exit}}')
  [ -n "$LW" ] && export SCREEN_W="$LW"
fi
# Kör kiosken i en egen dbus-session (behövs av webbläsaren).
exec dbus-run-session -- /bin/sh -c "openbox & exec \"$KIOSK\""
XINITRC
chmod +x "$HOME_DIR/.xinitrc"

# --- 6) Se till att en kiosk.env finns (för skärmbredd/andra musen/touch) ----
[ -f "$HERE/kiosk.env" ] || cp "$HERE/kiosk.env.example" "$HERE/kiosk.env" 2>/dev/null || true

# --- 7) Den gamla GDM-baserade kiosk-tjänsten behövs inte längre här ---------
systemctl --user disable forhandlingen-kiosk.service 2>/dev/null || true

say "KLART."
cat <<EOF

Nästa steg:
  sudo reboot
NUC:en bootar då rakt in i Förhandlingen på Xorg (vänster = Valv Syd, höger = Valv Nord).

Bra att veta:
  • Bryta ut ur kiosken:  tryck Ctrl+Alt+F2, logga in ($USER_NAME / lösenordet).
  • Skärmbredd/andra musen/touch ställs i:  $HERE/kiosk.env
  • Efter ändring i kiosk.env: starta om (sudo reboot) — eller döda webbläsaren
    (pkill chrom) så startar sessionen om sig själv.

Återställ till vanligt Ubuntu-skrivbord (om du vill ångra allt):
  sudo systemctl set-default graphical.target
  sudo systemctl enable gdm3
  sudo rm /etc/systemd/system/getty@tty1.service.d/override.conf
  (ta även bort raderna under FORHANDLINGEN-KIOSK-AUTOSTART i ~/.bash_profile)
  sudo reboot
EOF
