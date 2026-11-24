# Rösterna till exempelförhandlingens animatic (manus.json → assets/vo/<id>.mp3 + langder.json).
# Samma ElevenLabs-inställningar som Människa eller maskins exempelrunda. Viskningar läses lägre/lugnare.
# Nyckeln (ELEVENLABS_API_KEY) läses ur projektets .env och skrivs aldrig ut.
#   python3 -I gen_vo.py [utmapp]   generera det som saknas (standard assets/vo; appen: public/exempel/vo)
import json, subprocess, sys, urllib.request
from pathlib import Path

HAR = Path(__file__).resolve().parent
UT = Path(sys.argv[1]) if len(sys.argv) > 1 else HAR / "assets/vo"
MJ = Path("/Users/josefsjonneby/Kontext/Mjukvara")


def nyckel() -> str:
    for f in [MJ / "minnestest/server/.env", MJ / "xy-sortering/server/.env"]:
        if f.exists():
            for rad in f.read_text().splitlines():
                if rad.startswith("ELEVENLABS_API_KEY="):
                    return rad.split("=", 1)[1].strip().strip('"')
    sys.exit("hittar inte ELEVENLABS_API_KEY")


def main() -> None:
    m = json.loads((HAR.parents[1] / "src/stations/forhandlingen/exempel/manus.json").read_text())
    roller = m["roller"]
    rader = m["ram"] + [r for l in m["luckor"] for r in l["rader"]] + m["gissning"]["rader"] + m["slut"]
    UT.mkdir(parents=True, exist_ok=True)
    key = nyckel()
    for r in rader:
        mal = UT / f"{r['id']}.mp3"
        if mal.exists():
            continue
        rost = roller[r["vem"]]["rost"]
        viskar = r.get("viskar", False)
        body = {
            "text": r["text"].replace("VALdi", "Valdi"),
            "model_id": "eleven_multilingual_v2",
            "language_code": "sv",
            "voice_settings": {"stability": 0.35 if viskar else 0.5, "similarity_boost": 0.75,
                               "style": 0.3 if viskar else 0.15, "use_speaker_boost": True,
                               "speed": 1.05},
        }
        req = urllib.request.Request(f"https://api.elevenlabs.io/v1/text-to-speech/{rost}", data=json.dumps(body).encode(),
                                     headers={"xi-api-key": key, "Content-Type": "application/json", "Accept": "audio/mpeg"})
        mal.write_bytes(urllib.request.urlopen(req, timeout=120).read())
        print(r["id"], r["text"])
    langder = {}
    for r in rader:
        d = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(UT / f"{r['id']}.mp3")],
                           capture_output=True, text=True).stdout.strip()
        langder[r["id"]] = round(float(d), 2)
    (UT / "langder.json").write_text(json.dumps(langder, indent=1))
    print("total tal:", round(sum(langder.values()), 1), "s")


if __name__ == "__main__":
    main()
