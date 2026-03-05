import pyttsx3
import threading

class VoiceTTS:
    def __init__(self, rate=175, volume=1.0):
        """
        Initialize the TTS engine.
        Using pyttsx3 for stability and native Windows (SAPI5) support.
        """
        self.engine = pyttsx3.init()
        self.engine.setProperty('rate', rate)
        self.engine.setProperty('volume', volume)
        
        # Get and set a better voice if available
        voices = self.engine.getProperty('voices')
        if len(voices) > 1:
            # Usually voices[1] is a female voice, which often sounds clearer
            self.engine.setProperty('voice', voices[1].id)

    def speak(self, text: str):
        """Speak the text out loud (blocking)."""
        self.engine.say(text)
        self.engine.runAndWait()

    def speak_async(self, text: str):
        """Speak the text in a separate thread to avoid blocking the orchestrator."""
        threading.Thread(target=self.speak, args=(text,), daemon=True).start()
