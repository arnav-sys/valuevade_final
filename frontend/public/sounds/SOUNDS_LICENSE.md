# Gamification Sound Assets

Files in this directory:

* `xp_gain.wav` (~22 KB) — two-tone Duolingo-style "blip" played for any XP award.
* `level_up.wav` (~119 KB) — ascending C-major arpeggio + sustained chord, played
  for level-up overlays.

## License

**CC0 / Public Domain.** Both files are 100% original waveforms synthesised
programmatically in pure Python (no third-party samples / loops / instruments)
by `/app/scripts/generate_gamification_sounds.py`. They contain no copyrighted
material and may be redistributed under any license, including no license at
all.

The generator script is self-contained and uses only the Python stdlib
(`wave`, `math`, `struct`). Re-run it if you want to tweak the timbre or
length of either sound:

```bash
python3 /app/scripts/generate_gamification_sounds.py
```

## Why .wav and not .mp3?

Lossless PCM .wav is universally supported by `HTMLAudioElement` across every
major browser (Chrome, Safari, Firefox, Edge). Encoding to MP3 would require
shipping ffmpeg/sox into the build container; .wav side-steps that for files
this tiny (no real bandwidth difference at these sizes). If we later need
MP3 for hosting cost reasons, swap them in here and update `SOUND_SOURCES`
in `src/contexts/SoundContext.jsx`.
