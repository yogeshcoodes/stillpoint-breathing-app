(() => {
  'use strict';

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const root = document.documentElement;
  const breathVisual = $('#breathVisual');
  const breathOrb = $('#breathOrb');
  const phaseWord = $('#phaseWord');
  const phaseHint = $('#phaseHint');
  const practiceName = $('#practiceName');
  const sessionLength = $('#stageLength');
  const sessionState = $('#sessionState');
  const startButton = $('#startButton');
  const startLabel = $('#startLabel');
  const startIcon = $('#startIcon');
  const resetButton = $('#resetButton');
  const elapsedTime = $('#elapsedTime');
  const remainingTime = $('#remainingTime');
  const progressTrack = $('#progressTrack');
  const progressFill = $('#progressFill');
  const voiceToggle = $('#voiceToggle');
  const soundToggle = $('#soundToggle');
  const soundStyle = $('#soundStyle');
  const voiceSelect = $('#voiceSelect');
  const rhythmForm = $('#rhythmForm');
  const rhythmError = $('#rhythmError');
  const audioSupportNote = $('#audioSupportNote');
  const announcer = $('#announcer');

  const practices = {
    settle: {
      name: 'THE SETTLING BREATH', title: 'Settle', duration: 'A slow, even rhythm',
      description: 'A slow, even seven-second inhale and exhale give your attention one simple thing to follow. Keep each breath comfortable; you do not need to fill or empty your lungs completely.',
      phases: [{ id: 'inhale', word: 'Breathe in', hint: 'Gently through your nose', seconds: 7 }, { id: 'exhale', word: 'Breathe out', hint: 'Let the breath leave slowly', seconds: 7 }]
    },
    balance: {
      name: 'THE BALANCING BREATH', title: 'Balance', duration: 'An even, easy rhythm',
      description: 'Equal seven-second breaths give your attention a steady rhythm to follow. This is a no-hold option; shorten the timing if seven seconds feels like a stretch.',
      phases: [{ id: 'inhale', word: 'Breathe in', hint: 'Easy and unforced', seconds: 7 }, { id: 'exhale', word: 'Breathe out', hint: 'Same length, soft and steady', seconds: 7 }]
    },
    box: {
      name: 'BOX BREATHING', title: 'Box breath', duration: 'A structured four-step rhythm',
      description: 'A structured sequence: inhale, a gentle pause, exhale, then rest. This version uses a seven-second inhale and exhale with shorter four-second pauses. Skip the pauses if they feel uncomfortable.',
      phases: [{ id: 'inhale', word: 'Breathe in', hint: 'Fill comfortably, not fully', seconds: 7 }, { id: 'hold', word: 'Pause softly', hint: 'Only if comfortable', seconds: 4 }, { id: 'exhale', word: 'Breathe out', hint: 'Slow and relaxed', seconds: 7 }, { id: 'rest', word: 'Rest', hint: 'No need to pull in air', seconds: 4 }]
    },
    release: {
      name: 'THE LET-GO BREATH', title: 'Let go', duration: 'A longer, relaxed exhale',
      description: 'The exhale is a little longer than the inhale, which some people find settling. Let air leave naturally; do not push it out.',
      phases: [{ id: 'inhale', word: 'Breathe in', hint: 'A small, comfortable breath', seconds: 4 }, { id: 'exhale', word: 'Breathe out', hint: 'Give yourself a little more time', seconds: 7 }]
    },
    custom: {
      name: 'YOUR CUSTOM RHYTHM', title: 'Custom rhythm', duration: 'Your own gentle pace',
      description: 'Your starting rhythm is seven seconds in and seven seconds out. Adjust it to suit your comfort; never force a long breath or hold.',
      phases: [{ id: 'inhale', word: 'Breathe in', hint: 'Gently through your nose', seconds: 7 }, { id: 'exhale', word: 'Breathe out', hint: 'Let the breath leave slowly', seconds: 7 }]
    }
  };

  let activePractice = 'settle';
  let durationSeconds = 300;
  let elapsedSeconds = 0;
  let isRunning = false;
  let isComplete = false;
  let hasStarted = false;
  let hasBreathingStarted = false;
  let isPreparing = false;
  let preparationTimerId = null;
  let preparationFallbackId = null;
  let intervalId = null;
  let phaseIndex = -1;
  let phaseStartedAt = 0;
  let audioContext = null;
  let activeNoiseSource = null;
  let speechAvailable = 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window;
  let speechVoices = [];
  let groundingIndex = 0;
  let groundingWasRunning = false;
  let groundingTimer = null;
  let sessionCount = 0;
  let phaseCycle = 0;
  let reducedMotion = false;

  const formatTime = (seconds) => {
    const safe = Math.max(0, Math.floor(seconds));
    return `${String(Math.floor(safe / 60)).padStart(2, '0')}:${String(safe % 60).padStart(2, '0')}`;
  };

  function savePreference(key, value) {
    try { localStorage.setItem(`stillpoint.${key}`, value); } catch (_) { /* private browsing may block storage */ }
  }
  function loadPreference(key, fallback) {
    try { return localStorage.getItem(`stillpoint.${key}`) ?? fallback; } catch (_) { return fallback; }
  }

  function setSwitch(button, enabled) {
    button.classList.toggle('is-on', enabled);
    button.setAttribute('aria-checked', String(enabled));
  }
  const voiceEnabled = () => voiceToggle.getAttribute('aria-checked') === 'true';
  const soundsEnabled = () => soundToggle.getAttribute('aria-checked') === 'true';

  function announce(message) { announcer.textContent = ''; window.setTimeout(() => { announcer.textContent = message; }, 20); }

  const likelyMaleVoice = (voice) => /\b(david|mark|guy|daniel|james|george|ryan|aaron|alex|fred|tom|liam|oliver|arthur|matthew|andrew|christopher|eric|brian|john|michael|richard|william|jason|paul|kevin|stephen|graham|lee|rishi|male)\b/i.test(voice.name || '');

  function getPreferredSpeechVoice() {
    if (!speechAvailable) return null;
    speechVoices = window.speechSynthesis.getVoices();
    const selection = voiceSelect?.value || loadPreference('speechVoice', 'auto-male');
    if (selection && selection !== 'auto-male') {
      const explicitlySelected = speechVoices.find(voice => voice.voiceURI === selection);
      if (explicitlySelected) return explicitlySelected;
    }
    const englishVoices = speechVoices.filter(voice => /^en([_-]|$)/i.test(voice.lang || ''));
    return englishVoices.find(likelyMaleVoice) || englishVoices.find(voice => /natural|neural/i.test(voice.name || '')) || englishVoices[0] || speechVoices.find(likelyMaleVoice) || speechVoices[0] || null;
  }

  function speak(message, interrupt = true, onFinished = null) {
    if (!voiceEnabled() || !speechAvailable) return false;
    try {
      if (interrupt) window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(message);
      const voice = getPreferredSpeechVoice();
      utterance.lang = voice?.lang || 'en-IN';
      if (voice) utterance.voice = voice;
      utterance.rate = 0.86;
      utterance.pitch = 0.9;
      utterance.volume = 0.82;
      if (typeof onFinished === 'function') {
        utterance.onend = onFinished;
        utterance.onerror = onFinished;
      }
      window.speechSynthesis.speak(utterance);
      return true;
    } catch (_) {
      audioSupportNote.textContent = 'Voice guidance is not available in this browser right now.';
      return false;
    }
  }

  function populateSpeechVoices() {
    if (!speechAvailable || !voiceSelect) return;
    speechVoices = window.speechSynthesis.getVoices();
    const savedSelection = loadPreference('speechVoice', 'auto-male');
    if (!speechVoices.length) {
      voiceSelect.replaceChildren();
      const loadingOption = document.createElement('option');
      loadingOption.value = 'auto-male';
      loadingOption.textContent = 'Loading device voices…';
      voiceSelect.appendChild(loadingOption);
      return; // Keep a previously chosen voice URI until the asynchronous voice list arrives.
    }
    const preferredEnglish = speechVoices.filter(voice => /^en([_-]|$)/i.test(voice.lang || ''));
    const choices = (preferredEnglish.length ? preferredEnglish : speechVoices).slice().sort((a, b) => {
      const maleDifference = Number(likelyMaleVoice(b)) - Number(likelyMaleVoice(a));
      return maleDifference || (a.name || '').localeCompare(b.name || '');
    });
    voiceSelect.replaceChildren();
    const automatic = document.createElement('option');
    automatic.value = 'auto-male';
    automatic.textContent = 'Auto · prefer male-sounding';
    voiceSelect.appendChild(automatic);
    choices.forEach(voice => {
      const option = document.createElement('option');
      option.value = voice.voiceURI;
      option.textContent = `${voice.name}${voice.lang ? ` · ${voice.lang}` : ''}`;
      voiceSelect.appendChild(option);
    });
    voiceSelect.value = choices.some(voice => voice.voiceURI === savedSelection) ? savedSelection : 'auto-male';
    if (choices.length && savedSelection !== voiceSelect.value) savePreference('speechVoice', voiceSelect.value);
    if (voiceEnabled() && !choices.some(likelyMaleVoice)) {
      audioSupportNote.textContent = choices.length
        ? 'This device has no clearly identifiable male-sounding voice; Auto uses its best available English voice.'
        : 'Voice list is loading. Start a session once, then check the voice options again.';
    }
  }

  function getAudioContext() {
    if (!audioContext) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) return null;
      audioContext = new AudioContextClass();
    }
    if (audioContext.state === 'suspended') audioContext.resume().catch(() => {});
    return audioContext;
  }

  function playTone(style = soundStyle.value) {
    if (!soundsEnabled()) return;
    const context = getAudioContext();
    if (!context) {
      audioSupportNote.textContent = 'Sound is unavailable here. Spoken guidance can still work.';
      return;
    }
    const now = context.currentTime;
    const settings = {
      bowl: { frequency: 432, type: 'sine', duration: 1.05, peak: 0.12, end: 0.0001 },
      wood: { frequency: 610, type: 'sine', duration: 0.45, peak: 0.095, end: 0.0001 },
      drop: { frequency: 710, type: 'sine', duration: 0.62, peak: 0.075, end: 0.0001 }
    }[style] || { frequency: 432, type: 'sine', duration: 1.05, peak: 0.12, end: 0.0001 };
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = settings.type;
    oscillator.frequency.setValueAtTime(settings.frequency, now);
    if (style === 'wood') oscillator.frequency.exponentialRampToValueAtTime(430, now + settings.duration * 0.7);
    if (style === 'drop') oscillator.frequency.exponentialRampToValueAtTime(420, now + settings.duration * 0.55);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(settings.peak, now + 0.025);
    gain.gain.exponentialRampToValueAtTime(settings.end, now + settings.duration);
    oscillator.connect(gain); gain.connect(context.destination);
    oscillator.start(now); oscillator.stop(now + settings.duration + 0.03);
  }

  function stopAudio() {
    if (window.speechSynthesis && speechAvailable) window.speechSynthesis.cancel();
    if (activeNoiseSource) { try { activeNoiseSource.stop(); } catch (_) {} activeNoiseSource = null; }
  }

  function phaseAtTime(totalSeconds) {
    const phases = practices[activePractice].phases;
    const cycleLength = phases.reduce((sum, phase) => sum + phase.seconds, 0);
    let position = Math.max(0, totalSeconds) % cycleLength;
    for (let i = 0; i < phases.length; i++) {
      if (position < phases[i].seconds) return { index: i, phase: phases[i], inPhase: position, cycleLength };
      position -= phases[i].seconds;
    }
    return { index: 0, phase: phases[0], inPhase: 0, cycleLength };
  }

  function updatePhase(atTime, forceCue = false, speakPhaseCue = true) {
    const found = phaseAtTime(atTime);
    if (!forceCue && found.index === phaseIndex) {
      const remain = Math.max(0, found.phase.seconds - found.inPhase);
      if (isRunning) phaseHint.textContent = `${found.phase.hint} · ${Math.ceil(remain)}s`;
      return;
    }
    phaseIndex = found.index;
    const phase = found.phase;
    breathVisual.dataset.phase = phase.id;
    breathVisual.style.setProperty('--phase-duration', `${Math.max(0.1, phase.seconds)}s`);
    phaseWord.textContent = phase.word;
    phaseHint.textContent = isRunning ? `${phase.hint} · ${Math.ceil(phase.seconds - found.inPhase)}s` : phase.hint;
    const voiceText = phase.id === 'hold' ? 'Pause softly, only if comfortable.' : phase.id === 'rest' ? 'Rest. Stay easy.' : phase.id === 'inhale' ? 'Breathe in.' : 'Breathe out.';
    playTone();
    if (speakPhaseCue) speak(voiceText);
    announce(`${phase.word}. ${phase.hint}`);
  }

  function updateProgress() {
    const remaining = durationSeconds - elapsedSeconds;
    elapsedTime.textContent = `${formatTime(elapsedSeconds)} elapsed`;
    remainingTime.textContent = `${formatTime(remaining)} remaining`;
    progressFill.style.width = `${Math.min(100, (elapsedSeconds / durationSeconds) * 100)}%`;
    progressTrack.setAttribute('aria-valuemax', String(durationSeconds));
    progressTrack.setAttribute('aria-valuenow', String(elapsedSeconds));
  }

  function setRunningUI() {
    if (isRunning) {
      startLabel.textContent = 'Pause session';
      startIcon.classList.add('is-pause');
      startIcon.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 6v12M16 6v12"></path></svg>';
      sessionState.textContent = 'You are doing enough';
    } else {
      startLabel.textContent = isComplete ? 'Start again' : hasStarted ? 'Resume session' : 'Begin session';
      startIcon.classList.remove('is-pause');
      startIcon.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 6 10 6-10 6z"></path></svg>';
      sessionState.textContent = isComplete ? 'A moment well spent' : elapsedSeconds > 0 ? 'Paused — take your time' : 'Ready when you are';
    }
  }

  function tick() {
    if (!isRunning) return;
    const nowElapsed = Math.floor((Date.now() - phaseStartedAt) / 1000);
    if (nowElapsed > elapsedSeconds) elapsedSeconds = Math.min(durationSeconds, nowElapsed);
    updateProgress();
    updatePhase(elapsedSeconds);
    if (elapsedSeconds >= durationSeconds) finishSession();
  }

  function clearPreparationTimers() {
    if (preparationTimerId) window.clearTimeout(preparationTimerId);
    if (preparationFallbackId) window.clearTimeout(preparationFallbackId);
    preparationTimerId = null;
    preparationFallbackId = null;
  }

  function startBreathing() {
    if (!isRunning || !isPreparing) return;
    clearPreparationTimers();
    isPreparing = false;
    hasBreathingStarted = true;
    elapsedSeconds = 0;
    phaseIndex = -1;
    phaseStartedAt = Date.now();
    if (intervalId) clearInterval(intervalId);
    intervalId = window.setInterval(tick, 200);
    setRunningUI();
    sessionState.textContent = 'Follow the rhythm, gently';
    phaseWord.textContent = 'Breathe in';
    phaseHint.textContent = 'Softly and comfortably';
    updatePhase(0, true, true);
    updateProgress();
    audioSupportNote.textContent = soundsEnabled() || voiceEnabled()
      ? 'Guidance is active. Keep your breath gentle and unforced.'
      : 'Session running without audio cues.';
  }

  function beginPreparation() {
    isPreparing = true;
    phaseIndex = -1;
    breathVisual.dataset.phase = 'prep';
    phaseWord.textContent = 'Get comfortable';
    phaseHint.textContent = 'A quiet pause comes before the first inhale';
    audioSupportNote.textContent = 'Find your posture first. Breathing starts after the guidance and a quiet pause.';
    setRunningUI();
    sessionState.textContent = 'Settle in first';

    const queueBreathingStart = () => {
      if (!isRunning || !isPreparing || preparationTimerId) return;
      if (preparationFallbackId) window.clearTimeout(preparationFallbackId);
      preparationFallbackId = null;
      preparationTimerId = window.setTimeout(() => {
        preparationTimerId = null;
        startBreathing();
      }, 5500);
      phaseHint.textContent = 'No rush. We begin in a few quiet seconds.';
    };

    // If a browser's speech engine fails to fire onend, do not leave the user stuck.
    preparationFallbackId = window.setTimeout(() => {
      if (!isRunning || !isPreparing) return;
      preparationFallbackId = null;
      if (preparationTimerId) window.clearTimeout(preparationTimerId);
      preparationTimerId = null;
      if (speechAvailable) window.speechSynthesis.cancel();
      startBreathing();
    }, 26000);

    const intro = `Welcome to ${practices[activePractice].title}. Find a comfortable, supported posture. Relax your shoulders and jaw. If it feels comfortable, gently close your eyes, or keep a soft gaze. Let your breathing stay natural. We will begin after a quiet pause.`;
    const spoken = speak(intro, true, queueBreathingStart);
    if (!spoken) queueBreathingStart();
    announce(`Get comfortable for ${practices[activePractice].title}. Breathing will begin after a quiet pause.`);
  }

  function startSession() {
    if (isComplete) {
      elapsedSeconds = 0;
      isComplete = false;
      hasStarted = false;
      hasBreathingStarted = false;
      isPreparing = false;
      phaseIndex = -1;
      phaseCycle = 0;
      updateProgress();
    }
    const context = getAudioContext();
    if (context && context.state === 'suspended') context.resume().catch(() => {});
    isRunning = true;
    hasStarted = true;
    setRunningUI();

    if (!hasBreathingStarted) {
      beginPreparation();
      return;
    }

    isPreparing = false;
    clearPreparationTimers();
    phaseStartedAt = Date.now() - elapsedSeconds * 1000;
    if (intervalId) clearInterval(intervalId);
    intervalId = window.setInterval(tick, 200);
    setRunningUI();
    updatePhase(elapsedSeconds, true, false);
    speak('Welcome back. Continue with an easy, comfortable breath.');
    audioSupportNote.textContent = 'Session resumed. Continue gently.';
  }

  function pauseSession() {
    isRunning = false;
    isPreparing = false;
    clearPreparationTimers();
    if (intervalId) clearInterval(intervalId);
    intervalId = null;
    setRunningUI();
    phaseHint.textContent = 'Paused. Take your time; resume whenever you like.';
    stopAudio();
  }

  function finishSession() {
    isRunning = false; isComplete = true; hasStarted = true; isPreparing = false;
    clearPreparationTimers();
    if (intervalId) clearInterval(intervalId);
    intervalId = null;
    elapsedSeconds = durationSeconds;
    updateProgress();
    breathVisual.dataset.phase = 'rest';
    phaseWord.textContent = 'Well done';
    phaseHint.textContent = 'No rush to move on.';
    sessionState.textContent = 'A moment well spent';
    setRunningUI();
    playTone();
    speak('Your session is complete. Take your time before moving on.');
    audioSupportNote.textContent = 'Session complete. Notice how you feel, without judgement.';
    sessionCount++;
    announce('Session complete. Take your time before moving on.');
  }

  function resetSession() {
    pauseSession();
    isComplete = false; hasStarted = false; hasBreathingStarted = false; isPreparing = false; elapsedSeconds = 0; phaseIndex = -1; phaseCycle = 0;
    breathVisual.dataset.phase = 'rest';
    phaseWord.textContent = 'Ready';
    phaseHint.textContent = practices[activePractice].duration;
    updateProgress(); setRunningUI();
    audioSupportNote.textContent = 'Audio begins when you start a session.';
    announce('Session reset. Start when you are ready.');
  }

  function syncCustomFields() {
    const phases = practices.custom.phases;
    const secondsFor = id => phases.find(phase => phase.id === id)?.seconds ?? 0;
    $('#customInhale').value = String(Math.max(3, secondsFor('inhale') || 7));
    $('#customHold').value = String(secondsFor('hold'));
    $('#customExhale').value = String(Math.max(3, secondsFor('exhale') || 7));
    $('#customRest').value = String(secondsFor('rest'));
  }

  function updatePracticeExplainer(id) {
    const explainer = $('#practiceExplainer');
    explainer.classList.remove('is-changing');
    // Restart the subtle content transition even when users switch quickly.
    void explainer.offsetWidth;
    $('#practiceDescription').textContent = practices[id].description;
    explainer.classList.add('is-changing');
    window.setTimeout(() => explainer.classList.remove('is-changing'), 420);
  }

  function changePractice(id) {
    if (!practices[id] || id === activePractice) {
      if (id === 'custom') $('#rhythmSettings').open = true;
      return;
    }
    const wasRunning = isRunning;
    if (wasRunning) pauseSession();
    activePractice = id;
    elapsedSeconds = 0; isComplete = false; hasStarted = false; hasBreathingStarted = false; isPreparing = false; phaseIndex = -1; phaseCycle = 0;
    $$('.practice-tab').forEach(button => {
      const active = button.dataset.practice === id;
      button.classList.toggle('active', active);
      button.setAttribute('aria-pressed', String(active));
    });
    const practice = practices[id];
    practiceName.textContent = practice.name;
    phaseWord.textContent = 'Ready';
    phaseHint.textContent = practice.duration;
    $('#applyRhythmButton').classList.remove('applied');
    $('#applyRhythmButton').innerHTML = 'Apply custom rhythm <span aria-hidden="true">→</span>';
    breathVisual.dataset.phase = 'rest';
    if (id === 'custom') {
      syncCustomFields();
      $('#rhythmSettings').open = true;
    }
    updatePracticeExplainer(id);
    updateProgress(); setRunningUI();
    if (wasRunning) startSession();
  }

  function changeDuration(minutes) {
    if (isRunning) pauseSession();
    durationSeconds = Number(minutes) * 60;
    elapsedSeconds = 0; isComplete = false; hasStarted = false; hasBreathingStarted = false; isPreparing = false; phaseIndex = -1;
    $$('.duration-option').forEach(button => {
      const active = Number(button.dataset.minutes) === Number(minutes);
      button.classList.toggle('active', active);
      button.setAttribute('aria-pressed', String(active));
    });
    sessionLength.textContent = `${Number(minutes)} ${Number(minutes) === 1 ? 'MINUTE' : 'MINUTES'}`;
    updateProgress(); setRunningUI();
    phaseWord.textContent = 'Ready';
    phaseHint.textContent = practices[activePractice].duration;
    breathVisual.dataset.phase = 'rest';
  }

  function setCustomField(input, min, max) {
    const parsed = input.value.trim() === '' ? NaN : Number(input.value);
    if (!Number.isFinite(parsed)) {
      input.value = String(min);
      input.setAttribute('aria-invalid', 'true');
      return { value: min, valid: false };
    }
    const value = Math.min(max, Math.max(min, Math.round(parsed)));
    input.value = String(value);
    input.setAttribute('aria-invalid', 'false');
    return { value, valid: true };
  }

  function applyCustomRhythm(event) {
    event.preventDefault();
    const fields = [
      [$('#customInhale'), 3, 10], [$('#customHold'), 0, 4],
      [$('#customExhale'), 3, 10], [$('#customRest'), 0, 4]
    ];
    const checked = fields.map(([input, min, max]) => setCustomField(input, min, max));
    if (checked.some(field => !field.valid)) {
      rhythmError.hidden = false;
      rhythmError.textContent = 'Enter whole seconds within the shown limits.';
      return;
    }
    rhythmError.hidden = true;
    const [inhale, hold, exhale, rest] = checked.map(field => field.value);
    const phases = [
      { id: 'inhale', word: 'Breathe in', hint: 'Gently and comfortably', seconds: inhale }
    ];
    if (hold > 0) phases.push({ id: 'hold', word: 'Pause softly', hint: 'Only if comfortable', seconds: hold });
    phases.push({ id: 'exhale', word: 'Breathe out', hint: 'Let the breath leave naturally', seconds: exhale });
    if (rest > 0) phases.push({ id: 'rest', word: 'Rest', hint: 'No need to pull in air', seconds: rest });

    const wasRunning = isRunning;
    if (wasRunning) pauseSession();
    practices.custom.phases = phases;
    activePractice = 'custom';
    isComplete = false; hasStarted = false; hasBreathingStarted = false; isPreparing = false; elapsedSeconds = 0; phaseIndex = -1; phaseCycle = 0;
    $$('.practice-tab').forEach(button => {
      const active = button.dataset.practice === 'custom';
      button.classList.toggle('active', active);
      button.setAttribute('aria-pressed', String(active));
    });
    practiceName.textContent = practices.custom.name;
    updatePracticeExplainer('custom');
    phaseWord.textContent = 'Ready';
    phaseHint.textContent = `In ${inhale}s · Out ${exhale}s${hold ? ` · Hold ${hold}s` : ''}${rest ? ` · Rest ${rest}s` : ''}`;
    sessionLength.textContent = `${Math.round(durationSeconds / 60)} MINUTES`;
    breathVisual.dataset.phase = 'rest';
    updateProgress(); setRunningUI();
    $('#applyRhythmButton').classList.add('applied');
    $('#applyRhythmButton').innerHTML = 'Custom rhythm applied <span aria-hidden="true">✓</span>';
    window.setTimeout(() => $('#applyRhythmButton').classList.remove('applied'), 1400);
    $('#rhythmSettings').open = true;
    audioSupportNote.textContent = 'Your custom rhythm is ready. Start when you feel comfortable.';
    announce('Custom breathing rhythm applied. The session will begin with an inhale.');
    if (wasRunning) startSession();
  }

  function toggleTheme() {
    const next = root.dataset.theme === 'night' ? 'day' : 'night';
    root.dataset.theme = next;
    $('#themeToggle').setAttribute('aria-label', next === 'night' ? 'Switch to warm light theme' : 'Switch to warm night theme');
    $('#themeToggle').title = next === 'night' ? 'Switch to warm light theme' : 'Switch to warm night theme';
    const themeMeta = $('meta[name="theme-color"]');
    if (themeMeta) themeMeta.setAttribute('content', next === 'night' ? '#242621' : '#f0eee5');
    const schemeMeta = $('meta[name="color-scheme"]');
    if (schemeMeta) schemeMeta.setAttribute('content', next === 'night' ? 'dark' : 'light');
    savePreference('theme', next);
  }

  function openGrounding() {
    groundingWasRunning = isRunning;
    if (isRunning) pauseSession();
    groundingIndex = 0;
    $('#groundingOverlay').hidden = false;
    updateGroundingStep();
    $('#closeGrounding').focus();
    speak('Let us take a moment to notice what is around you.');
  }
  function closeGrounding() {
    $('#groundingOverlay').hidden = true;
    if (groundingWasRunning) startSession();
    else stopAudio();
    $('#groundingButton').focus();
    if (groundingTimer) clearInterval(groundingTimer);
  }
  function updateGroundingStep() {
    $$('.ground-step').forEach((step, i) => step.classList.toggle('active', i === groundingIndex));
    $('#groundingStepCount').textContent = `Step ${groundingIndex + 1} of 4`;
    $('#nextGroundingStep').innerHTML = groundingIndex === 3 ? 'Finish <span aria-hidden="true">✓</span>' : 'Continue <span aria-hidden="true">→</span>';
    const steps = [
      'Name five things you can see.',
      'Notice four things you can feel.',
      'Listen for three sounds around you.',
      'Take one easy, unforced breath.'
    ];
    speak(steps[groundingIndex]);
  }
  function advanceGrounding() {
    if (groundingIndex < 3) { groundingIndex++; updateGroundingStep(); }
    else closeGrounding();
  }

  // Restore only low-risk presentation preferences; no wellness data is stored.
  const savedTheme = loadPreference('theme', 'night');
  root.dataset.theme = savedTheme === 'day' ? 'day' : 'night';
  const themeMeta = $('meta[name="theme-color"]');
  if (themeMeta) themeMeta.setAttribute('content', root.dataset.theme === 'night' ? '#242621' : '#f0eee5');
  const schemeMeta = $('meta[name="color-scheme"]');
  if (schemeMeta) schemeMeta.setAttribute('content', root.dataset.theme === 'night' ? 'dark' : 'light');
  setSwitch(voiceToggle, loadPreference('voice', 'true') !== 'false');
  setSwitch(soundToggle, loadPreference('sound', 'true') !== 'false');
  if (speechAvailable) {
    populateSpeechVoices();
    window.speechSynthesis.addEventListener?.('voiceschanged', populateSpeechVoices);
    window.setTimeout(populateSpeechVoices, 250);
  }
  if (!speechAvailable) {
    setSwitch(voiceToggle, false); voiceToggle.disabled = true;
    audioSupportNote.textContent = 'Voice guidance is not supported here. Gentle cue sounds are still available.';
  }
  const reducedByOS = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  reducedMotion = reducedByOS;
  if (reducedMotion) root.classList.add('reduce-motion');
  $('#reduceMotionButton').setAttribute('aria-pressed', String(reducedMotion));
  $('#reduceMotionButton').textContent = reducedMotion ? 'Motion reduced' : 'Reduce motion';
  updateProgress();
  updatePracticeExplainer(activePractice);

  startButton.addEventListener('click', () => isRunning ? pauseSession() : startSession());
  resetButton.addEventListener('click', resetSession);
  $$('.practice-tab').forEach(button => button.addEventListener('click', () => changePractice(button.dataset.practice)));
  $$('.duration-option').forEach(button => button.addEventListener('click', () => changeDuration(button.dataset.minutes)));
  rhythmForm.addEventListener('submit', applyCustomRhythm);
  $('#themeToggle').addEventListener('click', toggleTheme);
  voiceToggle.addEventListener('click', () => {
    const next = !voiceEnabled(); setSwitch(voiceToggle, next); savePreference('voice', String(next));
    if (!next && speechAvailable) window.speechSynthesis.cancel();
    else if (next) speak('Spoken guidance is on.');
  });
  soundToggle.addEventListener('click', () => {
    const next = !soundsEnabled(); setSwitch(soundToggle, next); savePreference('sound', String(next));
    if (next) playTone();
  });
  soundStyle.addEventListener('change', () => { playTone(soundStyle.value); });
  voiceSelect.addEventListener('change', () => {
    const selected = speechAvailable ? voiceSelect.value : 'auto-male';
    savePreference('speechVoice', selected);
    if (voiceEnabled()) speak('This is your selected voice.');
  });
  $('#testVoiceButton').addEventListener('click', () => {
    if (!speechAvailable) {
      audioSupportNote.textContent = 'Spoken voice is not supported in this browser. Cue sounds remain available.';
      return;
    }
    setSwitch(voiceToggle, true);
    savePreference('voice', 'true');
    speak('Hello. Breathe in gently, then let your breath out slowly. Keep the breath comfortable and natural.');
    audioSupportNote.textContent = 'Voice preview started. Voice options depend on this device and browser.';
  });
  $('#testSoundButton').addEventListener('click', () => {
    const context = getAudioContext();
    if (context) {
      // Preview respects the selected cue style even if session cues are toggled off.
      const previous = soundsEnabled();
      if (!previous) setSwitch(soundToggle, true);
      playTone(soundStyle.value);
      if (!previous) setSwitch(soundToggle, false);
      audioSupportNote.textContent = 'Preview played. Adjust your volume to a comfortable level.';
    } else audioSupportNote.textContent = 'Audio is not supported in this browser.';
  });
  $('#groundingButton').addEventListener('click', openGrounding);
  $('#closeGrounding').addEventListener('click', closeGrounding);
  $('#nextGroundingStep').addEventListener('click', advanceGrounding);
  $('#groundingOverlay').addEventListener('click', event => { if (event.target === $('#groundingOverlay')) closeGrounding(); });
  $('#reduceMotionButton').addEventListener('click', () => {
    reducedMotion = !reducedMotion;
    root.classList.toggle('reduce-motion', reducedMotion);
    $('#reduceMotionButton').setAttribute('aria-pressed', String(reducedMotion));
    $('#reduceMotionButton').textContent = reducedMotion ? 'Motion reduced' : 'Reduce motion';
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && !$('#groundingOverlay').hidden) closeGrounding();
  });
  document.addEventListener('visibilitychange', () => {
    // Do not let hidden/background tabs silently advance a guided session.
    if (document.hidden && isRunning) pauseSession();
  });
  window.addEventListener('pagehide', () => {
    if (intervalId) clearInterval(intervalId);
    clearPreparationTimers();
    stopAudio();
    if (audioContext && audioContext.state !== 'closed') audioContext.close().catch(() => {});
  });
})();
