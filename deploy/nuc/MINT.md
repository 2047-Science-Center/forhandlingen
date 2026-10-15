# Förhandlingen på Linux Mint (testnuc) — steg för steg

Detta är Mint-varianten av `NUC-INSTALL.md`. Mint (Cinnamon) kör **X11** och
**LightDM** som standard, så ingen Wayland-/Xorg-krångling behövs: man kör på det
vanliga skrivbordet och styr allt med **tre skrivbordsikoner**:

| Ikon | Gör | Skript |
|------|-----|--------|
| **Starta Förhandlingen** | öppnar Valv Syd (vänster skärm) + Valv Nord (höger). Säker att dubbelklicka. | `start.sh` |
| **Starta om Förhandlingen** | stänger och öppnar skärmarna igen, **utan att starta om datorn** | `restart.sh` |
| **Uppdatera Förhandlingen** | `git pull` + ny build + ladda om (öppnar en terminal) | `update.sh` |

Avsluta spelet med appens **✕ Avsluta** (nere till vänster) — det stänger båda skärmarna.

## Mint jämfört med Ubuntu — det som skiljer

| Område | Ubuntu (befintlig väg) | Linux Mint (denna fil) |
|--------|------------------------|------------------------|
| Inloggning | GDM3 | **LightDM** (`slick-greeter`) |
| Session | GNOME på Wayland (X11-session borttagen från GNOME 49) | **Cinnamon på X11** — redan rätt. Välj *inte* "Cinnamon on Wayland" |
| Bar Xorg-kiosk (`setup-xorg.sh`) | behövs bara för två oberoende möss | **behövs normalt inte** (skriptet känner nu igen LightDM och varnar) |
| Autologin | `/etc/gdm3/custom.conf` | `/etc/lightdm/lightdm.conf.d/90-forhandlingen-autologin.conf` (`mint-setup.sh --autologin`) eller Meny → *Inloggningsfönster* |
| Skrivbordsikon | GNOME/Nautilus | **Nemo**: ikonen måste vara körbar **och** `gio set … metadata::trusted true` — `install-launcher.sh` gör båda och verifierar |
| Autostart av spelet | systemd-user-tjänst (`install.sh` utan `--server-only`) | **XDG-autostart** (`mint-setup.sh --autostart`). Kör `install.sh --server-only` så krockar inget |
| Skärmsläckare/lås/strömspar | `org.gnome.*` | `org.cinnamon.*` (sätts av `mint-setup.sh`) |
| Webbläsare | `chromium-browser` = **snap** (struntar i ljud per valv) | Mint blockerar snap; `chromium` ska vara en riktig deb. Google Chrome (.deb) är fortfarande förstahandsvalet. `mint-check.sh` flaggar snap |
| Skärmlayout | `xrandr` i `~/.xinitrc` (bar Xorg) | **Cinnamon → Skärmar** (eller auto: `kiosk.sh` läser `xrandr --listmonitors` och lägger Syd längst till vänster, Nord längst till höger) |
| Node via apt | 20+ på nyare Ubuntu | Mints apt har ofta **Node 18** → installera Node 20 via NodeSource (steg 2) |

---

## Installation på testnucen (numrerade steg)

Allt körs i en terminal **på själva skrivbordet** (Ctrl+Alt+T), inte över SSH
(ikoner och `gio` behöver skrivbordssessionen). Sudo-lösenordet skriver du själv
när det frågas — det sparas aldrig i någon fil.

### 0. Logga in på rätt session
Vid inloggningen: klicka kugghjulet/sessionsväljaren och välj **Cinnamon**
(inte "Cinnamon on Wayland"). Kontrollera i terminalen:
```bash
echo $XDG_SESSION_TYPE
```
Ska skriva `x11`.

### 1. Hämta koden
```bash
sudo apt update && sudo apt install -y git curl
git clone https://github.com/2047-Science-Center/forhandlingen.git ~/forhandlingen
cd ~/forhandlingen
git checkout testomgang-1-uppdatering
```
(Grenen måste vara pushad till GitHub först. Frågar git efter inloggning: ange
ditt GitHub-användarnamn och en personlig åtkomsttoken — spara den inte i någon
fil.) Efter detta följer `update.sh` den gren du checkat ut.

### 2. Node 20+ (hoppa över om `node -v` redan visar v20 eller högre)
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
node -v
```

### 3. Webbläsare (hoppa över om Chrome/Chromium redan finns)
Bäst (för ljud per valv) — Google Chrome:
```bash
cd /tmp
wget https://dl.google.com/linux/direct/google-chrome-stable_current_amd64.deb
sudo apt install -y ./google-chrome-stable_current_amd64.deb
cd ~/forhandlingen
```
(ca 110 MB — vänta tills prompten kommer tillbaka.) Duger för ett första test:
`sudo apt install -y chromium`.

### 4. Bygg appen och installera servern
```bash
cd ~/forhandlingen
bash deploy/nuc/install.sh --server-only
```
**Såhär ser du att det funkade:** sista raderna säger `Servern svarar på
http://localhost:8080 ✓` och `Klart.` Dubbelkolla:
```bash
curl -s localhost:8080/healthz
```
→ ska skriva `ok`.

### 5. Mint-förberedelse + ikoner
```bash
bash deploy/nuc/mint-setup.sh
```
Vill du att testnucen ska bete sig som en riktig kiosk (startar själv efter
omstart) lägger du på flaggor — gör det gärna *efter* att steg 6–7 fungerar:
```bash
bash deploy/nuc/mint-setup.sh --autostart --autologin
```
**Såhär ser du att det funkade:** sista rubriken `KLART` utan röda/gula `!!`-rader,
och tre ikoner på skrivbordet. Visar en ikon "untrusted"/öppnas som text:
högerklicka → **Tillåt start** (Allow Launching) en gång.

### 6. Kontrollera allt
```bash
bash deploy/nuc/mint-check.sh
```
Gröna `OK` på session (x11), verktyg, server, ikoner (körbar + betrodd).
Touch/ljud visas bara som info — de avgörs i steg 8.

### 7. Starta spelet
Dubbelklicka **Starta Förhandlingen**.
**Såhär ser du att det funkade:** en notis "Startar Förhandlingen ..." och efter
några sekunder två helskärmsfönster — Valv Syd vänster, Valv Nord höger. Tryck
igenom öppningen på båda → onboarding startar synkat.

* Bara **en skärm** på testnucen? Lägg `VALV=syd` (eller `VALV=nord`) i
  `deploy/nuc/kiosk.env` (`nano deploy/nuc/kiosk.env`) och tryck **Starta om**.
* Dubbelklickar du igen medan det kör händer inget (notis: "redan igång").

### 8. Prova de två andra knapparna
* **Starta om Förhandlingen** — fönstren stängs och öppnas igen på ~5–10 s,
  datorn startas *inte* om. (Används om skärmarna hänger/är vita.)
* **Uppdatera Förhandlingen** — en terminal visar `git pull`, bygge och omladdning,
  och slutar med `Klart!` + versionen (`Version: <hash> <senaste commit-rubrik>`).
  Inget nytt? Då står det `Redan senaste versionen` (tvinga med
  `bash deploy/nuc/update.sh --force`).

### 9. Touch (när paneler är inkopplade)
```bash
bash deploy/nuc/find-touch.sh
```
Skriver ut skärmarnas namn och panelernas USB-port. Klistra raderna i
`deploy/nuc/kiosk.env` (öppna med `nano`, **inte** en grafisk editor — den kan ge
osynliga tecken; filen städas dock av skripten):
```
TOUCH_PATH_LEFT="<ID_PATH vänster>"   ; OUTPUT_LEFT=<skärm vänster>
TOUCH_PATH_RIGHT="<ID_PATH höger>"    ; OUTPUT_RIGHT=<skärm höger>
TOUCH_WATCH=5
```
Tryck **Starta om Förhandlingen**; tryck på en skärm — pekaren ska hamna på samma
skärm. Fel skärm → byt plats på de två `ID_PATH`-raderna. `TOUCH_WATCH=5` gör att
mappningen läggs om var 5:e sekund (läker efter strömblink/hotplug).

> Alternativ: systerrepots fristående touch-baspaket
> `minnestest/deploy/mint-touchstation-bas/` (find/reset/watch + "Reset touch"-knapp)
> gör samma sak och kan köras bredvid.

### 10. Ljud per valv (när högtalare/HDMI-ljud är på plats)
```bash
pactl list short sinks | awk '{print $2}'
```
Sätt i `kiosk.env` (**bara sink-namnet**, kolumn 2):
```
SINK_LEFT="alsa_output.…"
SINK_RIGHT="alsa_output.…"
```
Ton-test per utgång: `paplay --device="<sink-namn>" /usr/share/sounds/alsa/Front_Center.wav`.
Starta om spelet och lyssna att Syd låter i vänster, Nord i höger.

---

## Autologin/autostart: ångra

* Autostart: `rm ~/.config/autostart/forhandlingen-start.desktop`
* Autologin: `sudo rm /etc/lightdm/lightdm.conf.d/90-forhandlingen-autologin.conf` och starta om.

## Fastnat? (escape)

Detta är ett vanligt skrivbord, så det finns inget att "ta sig ur": **✕ Avsluta**
i appen, eller `Alt+F4` på ett fönster. Hänger allt: `Ctrl+Alt+F2` → logga in →
`bash ~/forhandlingen/deploy/nuc/restart.sh`, eller `pkill -f forhandlingen-kiosk`.

## Felsökning

| Symptom | Åtgärd |
|---------|--------|
| Dubbelklick på ikon gör inget / "untrusted" | Högerklicka → *Tillåt start*; eller `bash deploy/nuc/install-launcher.sh` igen |
| Notis "servern svarar inte" | `sudo systemctl status forhandlingen-server`, `sudo journalctl -u forhandlingen-server -n 50` |
| Notis "skärmarna startade inte" | `tail -n 40 ~/.forhandlingen-kiosk/kiosk.log` — ofta saknas webbläsare |
| Vitt/tomt andra fönster | Höj `LAUNCH_GAP=8` i `kiosk.env` |
| Båda fönstren på samma skärm | Ställ in skärmarna sida vid sida i *Skärmar*, eller sätt `LEFT_POS`/`RIGHT_POS` i `kiosk.env` |
| Touch på fel skärm | Se steg 9; kolla `echo $XDG_SESSION_TYPE` = `x11` |
| Allt ljud på samma utgång | `mint-check.sh` flaggar snap-webbläsare → installera Google Chrome (.deb); kolla att `SINK_*` är rena sink-namn |
| `command not found` efter redigering av `kiosk.env` | Osynligt tecken — skriv om raden i `nano` |

## Vad som INTE kunnat verifieras utan en riktig Mint-NUC

Skripten är syntaxkontrollerade (`bash -n`) och logiken (start/omstart/
uppdatering, fönsterpositioner, `VALV`, städning av `kiosk.env`, ikon-installation)
är testad mot låtsas-Chrome/-xrandr/-git på en annan dator. **Kvar att prova på plats:**

1. `gio set … metadata::trusted` + dubbelklick i **Nemo** (ikonen startar utan varning).
2. **LightDM-autologin** (`--autologin`): att den loggar in i X11-sessionen `cinnamon`.
3. **Cinnamon-autostart** med 8 s fördröjning (`--autostart`) efter omstart.
4. Riktig **Chrome/Chromium**: `--app --start-fullscreen --window-position` lägger
   rätt fönster på rätt skärm i Cinnamon (inte bara på en).
5. **Touch → skärm** (`xinput map-to-output`, `TOUCH_WATCH`) med de riktiga panelerna.
6. **Ljud per valv** (`SINK_LEFT/RIGHT`, PipeWire/Pulse) — ton-test per utgång.
7. `gsettings`-nycklarna för skärmsläckare/lås/strömspar på just din Cinnamon-version.
8. Att `mint-check.sh` ger rätt `OK`/`!!` på Mint (på testdatorn var det en Mac).
