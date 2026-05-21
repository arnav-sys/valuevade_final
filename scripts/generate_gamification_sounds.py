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


# 3) streak_milestone.wav — quick rising chime, ~1.5s, distinct from level_up
def make_streak_milestone():
    # Bell-like 4-note rising line (D5 -> F#5 -> A5 -> D6), each ~280ms with overlap
    NOTES = [587.33, 739.99, 880.00, 1174.66]
    note_dur_ms = 280
    overlap_ms = 70
    note_n = int(SR * note_dur_ms / 1000)
    overlap_n = int(SR * overlap_ms / 1000)

    track = [0.0] * (note_n * len(NOTES) + 100)
    cursor = 0
    for f in NOTES:
        envelope = fade(tone(f, note_dur_ms), attack_ms=2, release_ms=180)
        for i, v in enumerate(envelope):
            if cursor + i < len(track):
                track[cursor + i] += v
        cursor += note_n - overlap_n

    # Sparkle: small high blip on top at 200ms
    sparkle = fade(tone(2200, 120, sweep_end=2640), attack_ms=4, release_ms=80)
    start = int(SR * 0.2)
    for i, v in enumerate(sparkle):
        if start + i < len(track):
            track[start + i] += v * 0.6

    samples = mix(track, gain=1.0)
    write_wav(OUT / "streak_milestone.wav", samples)


# 4) badge_unlock.wav — satisfying "ding" with bell sustain, ~0.9s
def make_badge_unlock():
    # Quick rise (60ms) then bell-like sustained chord (~700ms) for richness.
    gliss = fade(tone(1046.50, 60, sweep_end=1318.51), attack_ms=2, release_ms=20)
    bell = fade(
        mix(
            tone(1567.98, 700),                       # G6
            tone(1975.53, 700),                       # B6
            tone(2349.32, 700, vibrato=True),         # D7 sparkle
        ),
        attack_ms=4, release_ms=520,
    )
    samples = gliss + [0.0] * int(SR * 0.02) + bell
    samples = mix(samples, gain=0.95)
    write_wav(OUT / "badge_unlock.wav", samples)


# 5) daily_champion.wav — gold fanfare for Daily Champion overlay.
#    Distinct from level_up (which is a clean arpeggio→chord) and badge_unlock
#    (which is a bell ding). This one is BRASSY + RHYTHMIC: a herald-style
#    triplet "ta-ta-TA!" using stacked harmonics on perfect fifths (the
#    classic V→I cadence), then a sustained brassy "TADA" major-chord resolve.
#    Target ~1.4s total.
def make_daily_champion():
    def brassy(freq, ms, vibrato=False, sweep_end=None):
        """Brassy tone = sum of harmonics 1,2,3,4 with decaying amplitudes.
        Stacking integer multiples gives a sawtooth-flavoured spectrum that
        reads as 'horn' to the ear instead of pure sine 'flute'."""
        harmonics = [
            (1.0, 1.0),   # fundamental — strongest
            (2.0, 0.55),  # octave
            (3.0, 0.35),  # twelfth (fifth-up)
            (4.0, 0.18),  # double octave
        ]
        out = None
        for mult, amp in harmonics:
            t = tone(freq * mult, ms,
                     vibrato=vibrato,
                     sweep_end=(sweep_end * mult) if sweep_end is not None else None)
            t = [v * amp for v in t]
            if out is None:
                out = t
            else:
                out = [a + b for a, b in zip(out, t)]
        return out

    # Triplet herald: G4 → C5 → G5 (root, fifth, octave) — classic fanfare.
    # First two are short staccato hits, third is a longer accent.
    g4, c5, g5 = 392.00, 523.25, 783.99
    ta1 = fade(brassy(g4, 110), attack_ms=3, release_ms=70)
    ta2 = fade(brassy(c5, 110), attack_ms=3, release_ms=70)
    ta3 = fade(brassy(g5, 220, sweep_end=g5 * 1.02), attack_ms=3, release_ms=160)
    gap = [0.0] * int(SR * 0.025)
    herald = ta1 + gap + ta2 + gap + ta3

    # Big "TADA" resolution chord: C major (C5, E5, G5, C6) held for ~850ms
    # with mild vibrato on the top octave for shimmer. Brassy stack again for
    # richness; longer release for the gold/triumphant tail.
    chord_ms = 850
    chord = fade(
        mix(
            brassy(523.25, chord_ms),                # C5
            brassy(659.25, chord_ms),                # E5
            brassy(783.99, chord_ms),                # G5
            brassy(1046.50, chord_ms, vibrato=True), # C6 sparkle
        ),
        attack_ms=8,
        release_ms=500,
    )

    samples = herald + [0.0] * int(SR * 0.05) + chord
    samples = mix(samples, gain=1.0)
    write_wav(OUT / "daily_champion.wav", samples)



if __name__ == "__main__":
    make_xp_gain()
    make_level_up()
    make_streak_milestone()
    make_badge_unlock()
    make_daily_champion()


# 4) badge_unlock.wav — satisfying "ding" with reverb, ~1s, distinct from level_up
def make_badge_unlock():
    # Two-stage ding: pitched glissando + bell-like sustain.
    # Glissando (60ms): C6 -> E6, quick rise.
    gliss = fade(tone(1046.50, 60, sweep_end=1318.51), attack_ms=2, release_ms=20)
    # Bell strike (700ms): G6 + B6 stacked with a beating overtone (long release).
    bell = fade(
        mix(
            tone(1567.98, 700),                       # G6
            tone(1975.53, 700),                       # B6
            tone(2349.32, 700, vibrato=True),         # D7 sparkle
        ),
        attack_ms=4, release_ms=520,
    )
    # Small noise burst at the strike point for "click" texture.
    samples = gliss + [0.0] * int(SR * 0.02) + bell
    samples = mix(samples, gain=0.95)
    write_wav(OUT / "badge_unlock.wav", samples)
