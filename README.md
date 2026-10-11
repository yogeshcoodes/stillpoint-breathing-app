# Stillpoint — guided breathing app

A responsive, low-glare breathing and grounding app built with plain HTML, CSS, and JavaScript. On phones, the sound settings and grounding cards stack vertically and each fills the available width. It has no external CDN dependencies and can run locally or be hosted on static hosting.

## Run it

1. Extract the folder.
2. Open `index.html` in Brave, Chrome, Firefox, or Edge.
3. Click **Begin session** once to allow the browser to start audio.

For a local server (optional), run this from the project folder:

```bash
python -m http.server 8000
```

Then visit `http://localhost:8000`.

## Included

- Four guided breathing patterns plus a selectable Custom mode: Settle (7/7), Balance (7/7), Box (7/4/7/4, with shorter optional pauses), and Let go (4/7). Custom starts at 7 seconds in and 7 seconds out. Every cycle begins with an inhale.
- Each pattern has a short explanation of what the rhythm is for, with clear reminders that no breath should be forced and holds can be skipped.
- A posture-first introduction. The spoken guidance finishes before a 5.5-second quiet pause; only then does the first inhale and session timer begin. You can pause or reset during this preparation stage.
- A custom rhythm editor with inhale/exhale timing from 3–10 seconds and optional hold/rest timing from 0–4 seconds. Inputs are numeric, rounded, and clamped to those ranges in JavaScript; values are never evaluated as code.
- 1, 3, 5, and 10 minute sessions, pause/resume/reset, elapsed time, remaining time, and progress bar.
- Spoken cues using the browser's Speech Synthesis API with automatic preference for an English male-sounding voice when identifiable, a voice picker, and a preview button. Actual available voices depend on browser/device settings.
- Synthesized cue tones using Web Audio API; no audio files or libraries to download.
- Warm night and warm light themes with explicit CSS colors to reduce unwanted browser auto-darkening, including in Brave. Dropdowns, numeric fields, focus states, options, and scrollbars have matching styles.
- A four-step 30-second grounding prompt, responsive layouts, keyboard focus states, gentle state transitions, and reduced-motion setting.
- Theme and sound/voice preferences persist locally. Session history or personal wellbeing data is not stored.

## Voice availability

There is no practical way to guarantee a free, unlimited, always-online male TTS voice from a static frontend. This app uses the voices made available by the user's browser/operating system, which avoids API keys and third-party service quotas. Some devices may provide only a small voice list or no clearly male-sounding voice.

## Note

This is a relaxation aid, not medical care. Breath holds are optional and should be skipped if uncomfortable. Stop the exercise and return to normal breathing if you feel dizzy, breathless, or distressed. Custom timing limits are guardrails, not medical guarantees; choose a pace that remains comfortable.
