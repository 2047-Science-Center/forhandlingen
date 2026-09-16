# Firmware-skiss — luckljus (ESP32) · SKISSA, BYGG EJ NU

Separat litet leverabel, beställs för sig. Nämns här för helhet. **Appen äger
aldrig geometrin** — den säger bara "lucka N, tillstånd X". Firmwaren översätter
lucka → pixelintervall.

## Ansvar

- **ESP32** (PlatformIO + PubSubClient + FastLED) subscribar `station<N>/lights`.
- En **uppslagstabell lucka → pixelintervall** på tre WS2812-remsor (takremsa
  över rätt skåp + två frontremsor med täckskiva som exponerar ett fönster per
  lucka) äger geometrin. Byts remsa/skiva → ändra tabellen, inte appen.

## Meddelande in (fryst kontrakt, §5.1)

Topic: `station<N>/lights`

```json
{ "hatch": 1, "state": "active", "winner": null }      // glödande "öppna mig"
{ "hatch": 1, "state": "won",    "winner": "lag1" }    // vinnarens fosforfärg
{ "hatch": 3, "state": "off",    "winner": null }      // släckt
{ "state": "reset" }                                    // släck allt
```

Färger firmwaren mappar (matcha CRT-temat):
- `active` → bärnsten `#ff9500`, mjuk puls.
- `won` + `lag1` → cyan `#35e0d0`; `won` + `lag2` → fosforgrön `#7ad14f`.
- `off` → släckt.

## Pseudokod

```cpp
// station<N>/lights → sätt pixelintervall för luckan
void onLights(JsonDocument& msg) {
  if (msg["state"] == "reset") { allOff(); return; }
  int hatch = msg["hatch"];              // 1..5
  auto range = HATCH_PIXELS[hatch - 1];  // {start, end} — geometrin bor HÄR
  CRGB color = colorFor(msg["state"], msg["winner"]);
  fill(range.start, range.end, color);
  FastLED.show();
}
```

## Mocka utan hårdvara

```bash
mosquitto_pub -t station0/lights -m '{"hatch":1,"state":"active","winner":null}'
mosquitto_pub -t station0/lights -m '{"hatch":1,"state":"won","winner":"lag1"}'
mosquitto_pub -t station0/lights -m '{"state":"reset"}'
```

## Beställning till Erik (när signallistan fryses)

> Station Förhandlingen. Bygg luckljuset: tre WS2812-remsor (takremsa + två
> frontremsor med täckskiva, ett fönster per lucka), driven av ESP32 som
> subscribar `station<N>/lights` och sätter pixelintervall per lucka enligt
> uppslagstabell. Inget spelbeteende — bara: ta emot `{hatch,state,winner}` och
> lys rätt fönster i rätt färg. `reset` släcker allt. Bekräfta `STATION_N` mot
> riggen innan koppling.
