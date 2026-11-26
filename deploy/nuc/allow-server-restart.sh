#!/usr/bin/env bash
# Låt uppdateringen ("Uppdatera Förhandlingen") och restart.sh starta om server-tjänsten UTAN lösenord.
# Regeln gäller bara exakt `systemctl restart forhandlingen-server.service` — inget annat. Körs en gång per NUC
# (install.sh gör det också):   bash deploy/nuc/allow-server-restart.sh
# Varför: omstarten krävde sudo-lösenord; uteblev den körde servern gammal kod (t.ex. kiosk-avsluta).
set -eu
USER_NAME="${USER_NAME:-$(id -un)}"
RULE_FILE=/etc/sudoers.d/forhandlingen-server
tmp="$(mktemp)"
{
  echo "# Förhandlingen: uppdateringen får starta om servern utan lösenord (deploy/nuc/allow-server-restart.sh)"
  for sc in /usr/bin/systemctl /bin/systemctl; do
    echo "$USER_NAME ALL=(root) NOPASSWD: $sc restart forhandlingen-server.service"
  done
} > "$tmp"
if sudo visudo -cf "$tmp" >/dev/null; then
  sudo install -m 0440 -o root -g root "$tmp" "$RULE_FILE"
  echo "Klart: $USER_NAME får starta om forhandlingen-server.service utan lösenord ($RULE_FILE)."
else
  echo "FEL: sudo-regeln godkändes inte av visudo — inget ändrat." >&2
  rm -f "$tmp"; exit 1
fi
rm -f "$tmp"
