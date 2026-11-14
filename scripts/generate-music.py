"""Render the project's original deterministic soundtrack. Output is CC0-1.0."""
from pathlib import Path
import math
import struct
import subprocess
import tempfile
import wave

rate = 22050
duration = 96
chords = [(130.81, 164.81, 196), (110, 130.81, 164.81),
          (87.31, 110, 130.81), (98, 123.47, 146.83)]
target = Path(__file__).resolve().parents[1] / 'game/assets/resources/music/evening-loop.mp3'
target.parent.mkdir(parents=True, exist_ok=True)
with tempfile.TemporaryDirectory() as temporary:
    wav_path = Path(temporary) / 'original.wav'
    with wave.open(str(wav_path), 'wb') as output:
        output.setnchannels(2)
        output.setsampwidth(2)
        output.setframerate(rate)
        block = bytearray()
        for i in range(rate * duration):
            time = i / rate
            beat = time % .75
            chord = chords[int(time / 6) % 4]
            pad = sum(math.sin(2 * math.pi * frequency * time) for frequency in chord) * .035
            bass = math.sin(2 * math.pi * chord[0] / 2 * time) * math.exp(-beat * 4) * .12
            note = chord[int(time / .75) % 3] * (2 if int(time / 3) % 2 else 4)
            bell = math.sin(2 * math.pi * note * time) * math.exp(-beat * 7) * .09
            kick = math.sin(2 * math.pi * (48 * beat + 8 * (1 - math.exp(-beat * 20)))) * math.exp(-beat * 25) * .12
            fade = min(1, time / 2, (duration - time) / 2)
            for pan in [.97, 1.03]:
                sample = max(-1, min(1, (pad * pan + bass + bell / pan + kick) * fade))
                block.extend(struct.pack('<h', int(sample * 32767)))
            if len(block) > 262144:
                output.writeframes(block)
                block.clear()
        output.writeframes(block)
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', str(wav_path),
                    '-codec:a', 'libmp3lame', '-b:a', '96k', str(target)], check=True)
print(target)
