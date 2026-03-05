from faster_whisper import WhisperModel
import os

class VoiceSTT:
    def __init__(self, model_size="base", device="cpu", compute_type="int8"):
        """
        Initialize Faster-Whisper.
        model_size: tiny, base, small, medium, large-v3
        device: cpu or cuda
        """
        print(f"--- Loading Whisper Model: {model_size} ({device}) ---")
        self.model = WhisperModel(model_size, device=device, compute_type=compute_type)

    def transcribe(self, audio_path: str) -> str:
        """Transcribe an audio file to text."""
        if not os.path.exists(audio_path):
            return ""
        
        segments, info = self.model.transcribe(audio_path, beam_size=5)
        text = " ".join([segment.text for segment in segments])
        return text.strip()
