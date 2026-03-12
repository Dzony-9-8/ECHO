# emotion_detector.py
import nltk
from textblob import TextBlob
import json

class TextEmotionDetector:
    def __init__(self):
        # Download required NLTK data if not present
        try:
            from nltk.sentiment import SentimentIntensityAnalyzer
            self.sia = SentimentIntensityAnalyzer()
        except:
            nltk.download('vader_lexicon', quiet=True)
            from nltk.sentiment import SentimentIntensityAnalyzer
            self.sia = SentimentIntensityAnalyzer()
        
        # Emotion mapping rules
        self.emotion_rules = {
            "very_negative": {
                "range": (-1.0, -0.6),
                "keywords": ["hate", "angry", "terrible", "awful", "horrible", "disgusting"],
                "response_style": "supportive"
            },
            "negative": {
                "range": (-0.6, -0.2),
                "keywords": ["sad", "bad", "upset", "annoyed", "frustrated"],
                "response_style": "understanding"
            },
            "neutral": {
                "range": (-0.2, 0.2),
                "keywords": ["okay", "fine", "normal", "whatever"],
                "response_style": "neutral"
            },
            "positive": {
                "range": (0.2, 0.6),
                "keywords": ["good", "happy", "nice", "great", "cool"],
                "response_style": "encouraging"
            },
            "very_positive": {
                "range": (0.6, 1.0),
                "keywords": ["excellent", "amazing", "wonderful", "fantastic", "love"],
                "response_style": "celebratory"
            }
        }
    
    def analyze(self, text):
        """Analyze text and return emotional data"""
        if not text or not isinstance(text, str):
            return self._default_response()
        
        # Get sentiment scores
        scores = self.sia.polarity_scores(text)
        compound = scores['compound']
        
        # Get TextBlob sentiment for additional insight
        blob = TextBlob(text)
        polarity = blob.sentiment.polarity
        subjectivity = blob.sentiment.subjectivity
        
        # Determine primary emotion
        emotion = self._get_emotion_from_score(compound)
        emotion_data = self.emotion_rules.get(emotion, {})
        
        # Check for emotional keywords
        detected_keywords = []
        text_lower = text.lower()
        for kw in emotion_data.get("keywords", []):
            if kw in text_lower:
                detected_keywords.append(kw)
        
        # Determine emotion intensity
        intensity = abs(compound)
        if intensity < 0.3:
            intensity_level = "low"
        elif intensity < 0.7:
            intensity_level = "medium"
        else:
            intensity_level = "high"
        
        return {
            "emotion": emotion,
            "scores": {
                "compound": compound,
                "positive": scores['pos'],
                "negative": scores['neg'],
                "neutral": scores['neu'],
                "polarity": polarity,
                "subjectivity": subjectivity
            },
            "intensity": intensity_level,
            "detected_keywords": detected_keywords,
            "response_style": emotion_data.get("response_style", "neutral"),
            "text_length": len(text)
        }
    
    def _get_emotion_from_score(self, score):
        """Map sentiment score to emotion category"""
        if score >= 0.6:
            return "very_positive"
        elif score >= 0.2:
            return "positive"
        elif score > -0.2:
            return "neutral"
        elif score > -0.6:
            return "negative"
        else:
            return "very_negative"
    
    def _default_response(self):
        """Return default response for invalid input"""
        return {
            "emotion": "neutral",
            "scores": {
                "compound": 0.0,
                "positive": 0.0,
                "negative": 0.0,
                "neutral": 1.0,
                "polarity": 0.0,
                "subjectivity": 0.0
            },
            "intensity": "low",
            "detected_keywords": [],
            "response_style": "neutral",
            "text_length": 0
        }
    
    def get_emotional_summary(self, text):
        """Get a human-readable summary of emotional content"""
        analysis = self.analyze(text)
        
        summaries = {
            "very_negative": "The user is expressing strong negative emotions.",
            "negative": "The user seems to be having a difficult time.",
            "neutral": "The user's message is emotionally neutral.",
            "positive": "The user is expressing positive feelings.",
            "very_positive": "The user is extremely happy and enthusiastic!"
        }
        
        return summaries.get(analysis["emotion"], "Emotional state detected.")
