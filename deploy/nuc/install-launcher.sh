#!/usr/bin/env bash
# Lägger en dubbelklicks-ikon "Förhandlingen" på skrivbordet OCH i appmenyn,
# så Madde kan starta stationen utan terminal. Kör på NUC:en (som vanlig
# användare, inte sudo):
#     bash deploy/nuc/install-launcher.sh
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
KIOSK="$HERE/kiosk.sh"
chmod +x "$KIOSK"

# Bygg .desktop-filen med rätt sökväg.
tmp="$(mktemp)"
sed "s|@EXEC@|bash \"$KIOSK\"|g" "$HERE/forhandlingen.desktop" > "$tmp"

# 1) Appmenyn.
apps="$HOME/.local/share/applications"
mkdir -p "$apps"
install -m 0755 "$tmp" "$apps/forhandlingen.desktop"

# 2) Skrivbordet (om det finns) + markera som betrodd så GNOME låter en dubbelklicka.
desktop_dir="$(xdg-user-dir DESKTOP 2>/dev/null || echo "$HOME/Desktop")"
if [ -d "$desktop_dir" ]; then
  install -m 0755 "$tmp" "$desktop_dir/forhandlingen.desktop"
  gio set "$desktop_dir/forhandlingen.desktop" metadata::trusted true 2>/dev/null || true
fi
rm -f "$tmp"

# Uppdatera menydatabasen (om verktyget finns).
update-desktop-database "$apps" 2>/dev/null || true

echo "Klart. Ikonen 'Förhandlingen' finns nu på skrivbordet och i appmenyn."
echo "Dubbelklicka för att starta stationen. Avsluta med appens ✕-knapp (nere till vänster)."
