/**
 * Reusable Voice Service for MediKiosk
 * Handles Text-to-Speech (TTS) and Speech-to-Text (STT) in English and Hindi.
 */

export class VoiceService {
  private static recognition: any = null;
  private static isListening: boolean = false;
  private static currentUtterance: SpeechSynthesisUtterance | null = null;

  public static isSupported(): boolean {
    if (typeof window === "undefined") return false;
    return "speechSynthesis" in window;
  }

  public static isSTTSupported(): boolean {
    if (typeof window === "undefined") return false;
    return "webkitSpeechRecognition" in window || "SpeechRecognition" in window;
  }

  /**
   * Speak instruction text in chosen language (en / hi)
   */
  public static speak(text: string, lang: string = "en", onEnd?: () => void): void {
    if (!this.isSupported()) {
      if (onEnd) onEnd();
      return;
    }

    // Cancel any active speech
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = lang === "hi" ? "hi-IN" : "en-IN";
    utterance.rate = 0.9; // Slightly slower, calm cadence for healthcare kiosks
    utterance.pitch = 1.0;

    utterance.onend = () => {
      this.currentUtterance = null;
      if (onEnd) onEnd();
    };

    utterance.onerror = (e) => {
      console.warn("Speech synthesis error:", e);
      this.currentUtterance = null;
      if (onEnd) onEnd();
    };

    this.currentUtterance = utterance;
    window.speechSynthesis.speak(utterance);
  }

  public static stopSpeaking(): void {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
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
    if (!this.isSTTSupported()) {
      onError("Speech recognition not supported");
      if (onEnd) onEnd();
      return () => {};
    }

    try {
      const SpeechRecognition =
        (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      const recog = new SpeechRecognition();
      recog.lang = lang === "hi" ? "hi-IN" : "en-IN";
      recog.continuous = false;
      recog.interimResults = false;
      recog.maxAlternatives = 1;

      let gotResult = false;

      recog.onresult = (event: any) => {
        gotResult = true;
        const transcript = event.results[0][0].transcript;
        onResult(transcript);
      };

      recog.onerror = (event: any) => {
        console.warn("Speech recognition error:", event.error);
        onError(event.error);
      };

      recog.onend = () => {
        this.isListening = false;
        if (!gotResult) {
          // Ended without result
        }
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
