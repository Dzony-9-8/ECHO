# nlp_service.py
import spacy
import logging

class NLPService:
    def __init__(self, model_name="en_core_web_sm"):
        """Initialize the NLP Service with a Spacy model."""
        try:
            print(f"Loading NLP model: {model_name}...")
            self.nlp = spacy.load(model_name)
            print("NLP model loaded successfully.")
        except OSError:
            print(f"Model '{model_name}' not found. Downloading...")
            from spacy.cli import download
            download(model_name)
            self.nlp = spacy.load(model_name)

    def extract_entities(self, text):
        """
        Extract named entities from text.
        Returns a dictionary grouped by label (PERSON, ORG, GPE, etc.)
        """
        if not text:
            return {}

        doc = self.nlp(text)
        entities = {}
        
        for ent in doc.ents:
            label = ent.label_
            text = ent.text
            
            if label not in entities:
                entities[label] = []
            
            if text not in entities[label]:
                entities[label].append(text)
                
        return entities

    def get_context_string(self, entities):
        """Convert entity dictionary to a context string for the LLM."""
        if not entities:
            return ""
            
        parts = []
        # Prioritize key entity types
        if "PERSON" in entities:
            parts.append(f"People: {', '.join(entities['PERSON'])}")
        if "ORG" in entities:
            parts.append(f"Organizations: {', '.join(entities['ORG'])}")
        if "GPE" in entities:
            parts.append(f"Locations: {', '.join(entities['GPE'])}")
        if "DATE" in entities:
             parts.append(f"Dates: {', '.join(entities['DATE'])}")
        
        # Add other relevant types if needed
        
        if not parts:
            return ""
            
        return " | ".join(parts)
