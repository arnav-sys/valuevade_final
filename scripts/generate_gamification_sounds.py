#!/usr/bin/env python3
"""
Generate small WAV files used by the gamification SoundContext.

Outputs two files in /app/frontend/public/sounds/:
  - xp_gain.wav   ~250ms two-tone "blip" pleasant for XP toasts.
  - level_up.wav  ~1500ms ascending major chord arpeggio + tail for level-ups.

WAV (PCM 16-bit, 44.1kHz mono) is universally supported by HTMLAudioElement
across every modern browser, so we ship .wav rather than wrestling with
ffmpeg/sox to encode MP3. Files are tiny (under 200KB total).

This script has no external dependencies — only Python's stdlib `wave` +
`math` + `struct`. Re-run only when we want to tweak the sounds.
"""
import math
import struct
import wave
from pathlib import Path

OUT = Path("/app/frontend/public/sounds")
OUT.mkdir(parents=True, exist_ok=True)

SR = 44_100  # sample rate
AMP = 0.55   # global amplitude ceiling
MAX_INT = 32_767


def fade(samples, attack_ms=8, release_ms=30):
    """Linear attack/release envelope to avoid clicks."""
    n = len(samples)
    a = max(1, int(SR * attack_ms / 1000))
    r = max(1, int(SR * release_ms / 1000))
    for i in range(a):
        samples[i] *= i / a
    for i in range(r):
        samples[n - 1 - i] *= i / r
    return samples


def tone(freq, ms, vibrato=False, sweep_end=None):
    """Sine tone with optional linear-frequency sweep + soft vibrato."""
    n = int(SR * ms / 1000)
    out = [0.0] * n
    phase = 0.0
    for i in range(n):
        if sweep_end is not None:
            f = freq + (sweep_end - freq) * (i / max(1, n - 1))
        else:
            f = freq
        if vibrato:
            f += 4.0 * math.sin(2 * math.pi * 6.5 * i / SR)
        phase += 2 * math.pi * f / SR
        out[i] = math.sin(phase)
    return out


def mix(*tracks, gain=1.0):
    n = max(len(t) for t in tracks)
    out = [0.0] * n
    for t in tracks:
        for i, v in enumerate(t):
            out[i] += v
    peak = max(1e-9, max(abs(v) for v in out))
    scale = gain * AMP / peak
    return [v * scale for v in out]


def write_wav(path, samples):
    with wave.open(str(path), "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        buf = bytearray()
        for s in samples:
            v = max(-1.0, min(1.0, s))
            buf += struct.pack("<h", int(v * MAX_INT))
        w.writeframes(bytes(buf))
    print(f"wrote {path}  ({path.stat().st_size:,} bytes)")


# 1) xp_gain.wav — short two-tone Duolingo-style blip
def make_xp_gain():
    blip1 = fade(tone(880, 90), attack_ms=4, release_ms=40)
    blip2 = fade(tone(1320, 140, sweep_end=1660), attack_ms=4, release_ms=60)
    # space them sequentially
    silence_gap = [0.0] * int(SR * 0.02)
    samples = blip1 + silence_gap + blip2
    samples = mix(samples, gain=0.85)
    write_wav(OUT / "xp_gain.wav", samples)


# 2) level_up.wav — ascending major triad arpeggio + lifted tail chord
def make_level_up():
    # C major triad notes: C5, E5, G5, C6 (in Hz)
    NOTES = [523.25, 659.25, 783.99, 1046.50]
    arp_dur_ms = 140
    arpeggio = []
    for f in NOTES:
        arpeggio += fade(tone(f, arp_dur_ms), attack_ms=4, release_ms=60)
        arpeggio += [0.0] * int(SR * 0.012)  # tiny detache

    # Final sustained chord — sum of all four notes for 700ms
    chord_len_ms = 700
    chord = fade(
        mix(
            tone(NOTES[0], chord_len_ms),
            tone(NOTES[1], chord_len_ms),
            tone(NOTES[2], chord_len_ms),
            tone(NOTES[3], chord_len_ms, vibrato=True),
        ),
        attack_ms=10,
        release_ms=350,
    )

    samples = arpeggio + [0.0] * int(SR * 0.04) + chord
    samples = mix(samples, gain=1.0)
    write_wav(OUT / "level_up.wav", samples)


if __name__ == "__main__":
    make_xp_gain()
    make_level_up()
