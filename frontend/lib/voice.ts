/**
 * Reusable Voice Service for MediKiosk
 * Handles Text-to-Speech (TTS) and Speech-to-Text (STT) in English and Hindi.
 * Optimized for zero-latency instant playback, local offline voice prioritization,
 * and audio chime feedback.
 */

export class VoiceService {
  private static currentUtterance: SpeechSynthesisUtterance | null = null;
  private static recognition: any = null;
  private static isListening: boolean = false;
  private static audioCtx: AudioContext | null = null;
  private static cachedVoices: SpeechSynthesisVoice[] = [];
  private static isWarmed: boolean = false;

  public static isSupported(): boolean {
    if (typeof window === "undefined") return false;
    return "speechSynthesis" in window;
  }

  public static isSTTSupported(): boolean {
    if (typeof window === "undefined") return false;
    return "webkitSpeechRecognition" in window || "SpeechRecognition" in window;
  }

  /**
   * Play an immediate, pleasant 60ms audio chime via hardware Web Audio API (< 5ms latency)
   * Gives instant auditory feedback that an audio action was triggered.
   */
  public static playChime(): void {
    if (typeof window === "undefined") return;
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      if (!this.audioCtx || this.audioCtx.state === "closed") {
        this.audioCtx = new AudioCtx();
      }
      if (this.audioCtx.state === "suspended") {
        this.audioCtx.resume();
      }
      const ctx = this.audioCtx;
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(660, now);
      osc.frequency.exponentialRampToValueAtTime(990, now + 0.08);

      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.18);
    } catch (_) {
      // AudioContext fallback ignored safely
    }
  }

  /**
   * Pre-load voices list into memory
   */
  public static init(): void {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    const load = () => {
      try {
        this.cachedVoices = window.speechSynthesis.getVoices();
      } catch (_) {}
    };
    load();
    if (window.speechSynthesis.onvoiceschanged !== undefined) {
      window.speechSynthesis.onvoiceschanged = load;
    }
  }

  /**
   * Pre-warm speech synthesis engine on first user touch / click
   */
  public static warmUp(): void {
    if (this.isWarmed || typeof window === "undefined" || !("speechSynthesis" in window)) return;
    this.isWarmed = true;
    try {
      this.init();
      if (window.speechSynthesis.paused) {
        window.speechSynthesis.resume();
      }
      // Speak tiny silent utterance to wake up the browser audio render thread
      const silent = new SpeechSynthesisUtterance("");
      silent.volume = 0;
      window.speechSynthesis.speak(silent);
    } catch (_) {}
  }

  public static getLocaleTag(lang: string = "en"): string {
    switch (lang) {
      case "mr":
        return "mr-IN";
      case "kn":
        return "kn-IN";
      case "ta":
        return "ta-IN";
      case "or":
        return "or-IN";
      case "ne":
        return "ne-NP";
      case "hi":
        return "hi-IN";
      case "en":
      default:
        return "en-IN";
    }
  }

  /**
   * Find the best local offline voice to avoid Google Cloud TTS network buffering delays
   */
  public static getBestVoice(lang: string = "en"): SpeechSynthesisVoice | null {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return null;
    if (this.cachedVoices.length === 0) {
      this.cachedVoices = window.speechSynthesis.getVoices();
    }
    const targetTag = this.getLocaleTag(lang).toLowerCase();
    const targetPrefix = lang.toLowerCase();

    // 1. Exact locale match with localService
    const exactLocalMatch = this.cachedVoices.find(
      (v) => v.lang.toLowerCase().replace("_", "-") === targetTag && v.localService
    );
    if (exactLocalMatch) return exactLocalMatch;

    // 2. Language prefix match with localService
    const prefixLocalMatch = this.cachedVoices.find(
      (v) => v.lang.toLowerCase().startsWith(targetPrefix) && v.localService
    );
    if (prefixLocalMatch) return prefixLocalMatch;

    // 3. Any exact or prefix match
    const anyLangMatch = this.cachedVoices.find(
      (v) =>
        v.lang.toLowerCase().replace("_", "-") === targetTag ||
        v.lang.toLowerCase().startsWith(targetPrefix)
    );
    if (anyLangMatch) return anyLangMatch;

    // 4. Indian English / Hindi fallback for Indic scripts if regional voice is absent
    const indicFallback = this.cachedVoices.find((v) =>
      v.lang.toLowerCase().startsWith("hi") || v.lang.toLowerCase().startsWith("en-in")
    );
    if (indicFallback) return indicFallback;

    // 5. Fallback to default voice
    return this.cachedVoices.find((v) => v.default) || (this.cachedVoices[0] ?? null);
  }

  public static isCurrentlySpeaking(): boolean {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return false;
    return window.speechSynthesis.speaking;
  }

  /**
   * Speak instruction text in chosen language (en / hi / mr / kn / ta / or / ne) with zero-latency
   */
  public static speak(text: string, lang: string = "en", onEnd?: () => void): void {
    if (!this.isSupported() || !text) {
      if (onEnd) onEnd();
      return;
    }

    this.warmUp();

    // In Chromium, only cancel if actively speaking or pending to prevent audio channel stall
    if (window.speechSynthesis.speaking || window.speechSynthesis.pending) {
      try {
        window.speechSynthesis.cancel();
      } catch (_) {}
    }

    // Clear stuck pauses in Chromium
    if (window.speechSynthesis.paused) {
      try {
        window.speechSynthesis.resume();
      } catch (_) {}
    }

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = this.getLocaleTag(lang);
    utterance.rate = 1.0; // Natural, clear pace
    utterance.pitch = 1.0;

    const voice = this.getBestVoice(lang);
    if (voice) {
      utterance.voice = voice;
    }

    utterance.onend = () => {
      this.currentUtterance = null;
      if (onEnd) onEnd();
    };

    utterance.onerror = (e) => {
      if (e.error !== "interrupted" && e.error !== "canceled") {
        console.warn("Speech synthesis error:", e);
      }
      this.currentUtterance = null;
      if (onEnd) onEnd();
    };

    this.currentUtterance = utterance;

    try {
      window.speechSynthesis.speak(utterance);
    } catch (err) {
      console.warn("speechSynthesis.speak failed:", err);
      if (onEnd) onEnd();
    }
  }

  public static stopSpeaking(): void {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      try {
        window.speechSynthesis.cancel();
      } catch (_) {}
      this.currentUtterance = null;
    }
  }

  /**
   * Listen for user's spoken response
   */
  public static listen(
    lang: string = "en",
    onResult: (transcript: string) => void,
    onError: (err: string) => void,
    onEnd?: () => void
  ): () => void {
    // Stop any active TTS prompt so mic doesn't record the kiosk speaker
    this.stopSpeaking();
    this.playChime();

    if (!this.isSTTSupported()) {
      onError("Speech recognition not supported");
      if (onEnd) onEnd();
      return () => {};
    }

    try {
      const SpeechRecognition =
        (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      const recog = new SpeechRecognition();
      recog.lang = this.getLocaleTag(lang);
      recog.continuous = false;
      recog.interimResults = false;
      recog.maxAlternatives = 1;

      recog.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        onResult(transcript);
      };

      recog.onerror = (event: any) => {
        if (event.error !== "no-speech") {
          console.warn("Speech recognition error:", event.error);
        }
        onError(event.error);
      };

      recog.onend = () => {
        this.isListening = false;
        if (onEnd) onEnd();
      };

      this.recognition = recog;
      this.isListening = true;
      recog.start();

      // Return cleanup/stop function
      return () => {
        try {
          recog.stop();
        } catch (_) {}
        this.isListening = false;
      };
    } catch (err: any) {
      onError(err.message || "Failed to initialize microphone");
      if (onEnd) onEnd();
      return () => {};
    }
  }

  public static stopListening(): void {
    if (this.recognition && this.isListening) {
      try {
        this.recognition.stop();
      } catch (_) {}
      this.isListening = false;
    }
  }
}

