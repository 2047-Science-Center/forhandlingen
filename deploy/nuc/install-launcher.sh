#!/usr/bin/env bash
# Lägger tre dubbelklicks-ikoner på skrivbordet OCH i appmenyn, så Madde kan
# starta/starta om/uppdatera stationen utan terminal:
#     Starta Förhandlingen        -> start.sh
#     Starta om Förhandlingen     -> restart.sh
#     Uppdatera Förhandlingen     -> update.sh   (öppnar en terminal)
# Kör på NUC:en som vanlig användare (inte sudo):
#     bash deploy/nuc/install-launcher.sh
# Funkar på Ubuntu/GNOME och Linux Mint/Cinnamon (Nemo). Säker att köra om.
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
chmod +x "$HERE"/*.sh

apps="$HOME/.local/share/applications"
mkdir -p "$apps"
desktop_dir="$(xdg-user-dir DESKTOP 2>/dev/null || echo "$HOME/Desktop")"

problems=0

# install_one <mall.desktop> <skript.sh> <installerat-namn.desktop>
install_one() {
  local template="$1" script="$2" name="$3" tmp
  tmp="$(mktemp)"
  # Exec med citerad sökväg (klarar mellanslag). '&' och '|' i sökvägen skulle
  # störa sed — escapa dem.
  local esc
  esc="$(printf '%s' "$HERE/$script" | sed -e 's/[&|\\]/\\&/g')"
  sed "s|@EXEC@|bash \"$esc\"|g" "$HERE/$template" > "$tmp"

  # 1) Appmenyn.
  install -m 0755 "$tmp" "$apps/$name"

  # 2) Skrivbordet (om det finns). Körbar + "trusted":
  #    - Linux Mint / Cinnamon (Nemo) och GNOME (Nautilus) kräver +x och
  #      metadata::trusted för att en .desktop ska startas vid dubbelklick
  #      i stället för att öppnas som text / visa "untrusted launcher".
  #    - gio kräver en körande användarsession (gvfs/dbus). Körs skriptet över
  #      SSH utan session misslyckas det -> vi varnar och ber om manuell åtgärd.
  if [ -d "$desktop_dir" ]; then
    install -m 0755 "$tmp" "$desktop_dir/$name"
    if command -v gio >/dev/null 2>&1; then
      if gio set "$desktop_dir/$name" metadata::trusted true 2>/dev/null; then
        :
      else
        echo "  ! kunde inte markera $name som betrodd (gio). Högerklicka ikonen ->" >&2
        echo "    'Tillåt start' / 'Allow launching' (eller egenskaper -> Behörigheter)." >&2
        problems=$((problems + 1))
      fi
    fi
    echo "  ok  $desktop_dir/$name"
  else
    echo "  ok  (inget skrivbord hittat) bara i appmenyn: $apps/$name"
  fi
  rm -f "$tmp"
}

echo "Installerar ikoner ..."
install_one forhandlingen.desktop          start.sh   forhandlingen.desktop
install_one forhandlingen-restart.desktop  restart.sh forhandlingen-restart.desktop
install_one forhandlingen-update.desktop   update.sh  forhandlingen-update.desktop

# Uppdatera menydatabasen (om verktyget finns).
update-desktop-database "$apps" 2>/dev/null || true

# Verifiera: ikonen är körbar och betrodd (om gio finns).
if [ -d "$desktop_dir" ] && command -v gio >/dev/null 2>&1; then
  for n in forhandlingen forhandlingen-restart forhandlingen-update; do
    f="$desktop_dir/$n.desktop"
    t="$(gio info -a metadata::trusted "$f" 2>/dev/null | sed -n 's/^ *metadata::trusted: *//p')"
    if [ -x "$f" ] && [ "$t" = "true" ]; then
      echo "  verifierad: $n (körbar + betrodd)"
    else
      echo "  ! $n: körbar=$([ -x "$f" ] && echo ja || echo nej) betrodd=${t:-nej}" >&2
      problems=$((problems + 1))
    fi
  done
fi

echo
echo "Klart. På skrivbordet finns nu:  Starta Förhandlingen  |  Starta om Förhandlingen  |  Uppdatera Förhandlingen"
echo "Avsluta spelet med appens ✕-knapp (nere till vänster)."
if [ "$problems" -gt 0 ]; then
  echo
  echo "OBS: $problems anmärkning(ar) ovan — ikonerna kan visa 'untrusted' tills du" >&2
  echo "     högerklickat och tillåtit start. Se deploy/nuc/MINT.md." >&2
fi
