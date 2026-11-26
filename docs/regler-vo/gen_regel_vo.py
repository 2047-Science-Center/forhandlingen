# VALdis röst till de tre bildreglerna (onboarding/BildRegler.vue) → public/regler/vo/r1–r3.mp3.
# Samma röst och inställningar som exempelförhandlingen (docs/exempelforhandling-2026-11/gen_vo.py).
# Nyckeln (ELEVENLABS_API_KEY) läses ur en annan stations .env och skrivs aldrig ut.
#   python3 -I gen_regel_vo.py      generera det som saknas
import json, sys, urllib.request
from pathlib import Path

HAR = Path(__file__).resolve().parent
UT = HAR.parents[1] / "public/regler/vo"
MJ = Path("/Users/josefsjonneby/Kontext/Mjukvara")
VALDI = "BNgbHR0DNeZixGQVzloa"
RADER = {
    "r1": "Ett. Ni har en livsviktig resurs. Den måste ni köpa – annars blir det noll poäng.",
    "r2": "Två. Pengarna ni har kvar i slutet blir era poäng. Spendera så lite som möjligt.",
    "r3": "Tre. Gissa vilken resurs som var livsviktig för den andra sidan. Gissar ni rätt dubblas era poäng.",
}


def nyckel() -> str:
    for f in [MJ / "minnestest/server/.env", MJ / "xy-sortering/server/.env"]:
        if f.exists():
            for rad in f.read_text().splitlines():
                if rad.startswith("ELEVENLABS_API_KEY="):
                    return rad.split("=", 1)[1].strip().strip('"')
    sys.exit("hittar inte ELEVENLABS_API_KEY")


UT.mkdir(parents=True, exist_ok=True)
key = nyckel()
for rid, text in RADER.items():
    mal = UT / f"{rid}.mp3"
    if mal.exists():
        continue
    body = {"text": text, "model_id": "eleven_multilingual_v2", "language_code": "sv",
            "voice_settings": {"stability": 0.5, "similarity_boost": 0.75, "style": 0.15, "use_speaker_boost": True, "speed": 1.0}}
    req = urllib.request.Request(f"https://api.elevenlabs.io/v1/text-to-speech/{VALDI}", data=json.dumps(body).encode(),
                                 headers={"xi-api-key": key, "Content-Type": "application/json", "Accept": "audio/mpeg"})
    mal.write_bytes(urllib.request.urlopen(req, timeout=120).read())
    print(rid, text)
