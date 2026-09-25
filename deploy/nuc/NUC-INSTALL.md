# Förhandlingen på en NUC — installation (permanent kiosk-station)

Kör stationen på **en** Linux-NUC med **två skärmar**: vänster = **Valv Syd**
(`#lag1`), höger = **Valv Nord** (`#lag2`). Fönstren synkas lokalt via ett
same-origin-relä, så ingen internetuppkoppling behövs under körning.

> Detta är pilot-/testläget (`config.mode = 'pilot'`). Kopplingen mot riggens
> MQTT-ljus/RFID/resultat är förberedd men inte inkopplad — se sista avsnittet.

## 1. Förbered NUC:en (en gång)
Ubuntu (eller liknande) med en grafisk **X11**-session. Installera:

```bash
sudo apt update
sudo apt install -y git curl chromium   # eller chromium-browser
# Node 20+ (om det inte redan finns):
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
```

Rekommenderat för en kiosk som ska resa sig själv:
- **Autologin** till skrivbordet (t.ex. via GNOME/LightDM-inställningar).
- **X11**, inte Wayland (krävs för två oberoende muspekare och touch-mappning).

### Ubuntu Desktop kör Wayland — byt till en ren Xorg-kiosk
Ubuntu 24.04 Desktop kör GNOME på Wayland, där Chromium inte kan placeras på rätt
skärm och två möss (MPX) inte fungerar; ofta saknas dessutom ett Xorg-val i GDM.
Kör då `deploy/nuc/setup-xorg.sh` **efter** `install.sh` — det byter NUC:en till
en minimal Xorg-session (openbox) som bootar rakt in i de två kioskfönstren
(stänger av GDM, autologin på tty1, arrangerar skärmarna vänster→höger,
`~/.xinitrc` → openbox + `kiosk.sh`). Sedan `sudo reboot`. Verifiera med
`echo $XDG_SESSION_TYPE` (ska bli `x11`). Skriptet skriver också hur man
återställer till vanligt skrivbord. Bryt ur kiosken med **Ctrl+Alt+F2**.

## 2. Hämta och installera
```bash
git clone https://github.com/2047-Science-Center/forhandlingen.git
cd forhandlingen
deploy/nuc/install.sh
```

Installeraren bygger appen och sätter upp **två** tjänster:
- `forhandlingen-server` (system) — app + relä på port 8080, startar vid boot,
  startar om av sig själv (`Restart=always`).
- `forhandlingen-kiosk` (user) — startar de två kiosk-fönstren när den grafiska
  sessionen loggar in.

Bara servern (utan kiosk): `deploy/nuc/install.sh --server-only`.
Annan port: `deploy/nuc/install.sh --port 9090`.

## 3. Ställ in skärmar och (ev.) möss
Redigera `deploy/nuc/kiosk.env` (skapas från exemplet vid install):

- **Skärmbredd** — om skärmarna inte är 1920 px breda, sätt `SCREEN_W` så höger
  fönster hamnar på rätt skärm (eller sätt `LEFT_POS`/`RIGHT_POS` explicit).
- **Två möss (en pekare per skärm)** — kör `xinput list`, hitta den *andra*
  musen och sätt `SECOND_MOUSE="<dess namn>"`. Kiosken skapar då en andra
  pekare (Multi-Pointer X) så två personer kan klicka samtidigt, var och en på
  sin skärm. Appen är helt pekar-driven (inget tangentbord behövs).

Starta om kiosken efter ändring:
```bash
systemctl --user restart forhandlingen-kiosk
```

## 4. Verifiera
```bash
curl -s localhost:8080/healthz          # → ok
sudo systemctl status forhandlingen-server
systemctl --user status forhandlingen-kiosk
```
På skärmarna: vänster ska visa Valv Syd, höger Valv Nord. Tryck igenom
öppningen på båda → onboarding startar synkat.

## 5. Facilitator (Madde) under körning
Nere i vänstra hörnet finns **Paus** (fryser nedräkningen, lägger paus-overlay
på båda skärmarna) och **Starta om** (nollställer hela stationen, med
bekräftelse). Utan aktivitet på 8 minuter startar stationen om automatiskt till
startskärmen (med 20 s varning). Tiderna ligger i `IDLE_RESTART` i `src/config.ts`.

## 6. Uppdatera stationen senare
```bash
cd forhandlingen
git pull
npm run build:relay
sudo systemctl restart forhandlingen-server
# (kiosken behöver oftast bara laddas om:)
systemctl --user restart forhandlingen-kiosk
```

## 7. Loggar & felsökning
```bash
sudo journalctl -u forhandlingen-server -f     # serverloggar
systemctl --user status forhandlingen-kiosk    # kioskstatus
```
- **Svart skärm / ingen kiosk:** ingen grafisk autologin, eller Chromium saknas.
- **Höger fönster på fel skärm:** justera `SCREEN_W`/`RIGHT_POS` i `kiosk.env`.
- **Andra musen styr fel:** kolla namnet i `xinput list` mot `SECOND_MOUSE`.
- **Skärmarna synkas inte:** kontrollera att servern svarar (`/healthz`) — båda
  fönstren pratar med `ws://localhost:8080/ws`.

## 8. Touchskärmar (när de kommer) — ingen omflashing
Appen är redan byggd för touch (native kontroller). Anslut panelen — touch
funkar direkt i webbläsaren. Det enda som behövs är att mappa varje panels
touch till rätt skärm i `kiosk.env`:
```
TOUCH_LEFT="<enhet ur xinput list>"   ; OUTPUT_LEFT=HDMI-1
TOUCH_RIGHT="<enhet ur xinput list>"  ; OUTPUT_RIGHT=HDMI-2
```
(utgångsnamnen ser du med `xrandr`). Starta om kiosken. Ingen ombyggnad krävs.

## 9. Skarp rigg-drift (senare)
För att koppla mot X&Y-riggens hårdvara: bekräfta `STATION_N`, fyll
`config.production` från miljövariabler (**inga hemligheter i git**), fyll de tre
MQTT-stubbarna (`station<N>/lights|rfid|identity|result`) och sätt
`config.mode = 'production'`. Servern/kiosken ovan påverkas inte — bara
adaptrarna byter läge.
