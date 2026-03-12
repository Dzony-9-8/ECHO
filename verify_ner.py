# verify_ner.py
import sys
import os

# Add backend to path
sys.path.append(os.path.join(os.getcwd(), 'backend'))

try:
    from backend.nlp_service import NLPService
    
    print("Initializing NLP Service...")
    nlp = NLPService()
    
    test_text = "I met Elon Musk at Tesla headquarters in California yesterday."
    print(f"\nAnalyzing text: '{test_text}'")
    
    entities = nlp.extract_entities(test_text)
    print("\nDetected Entities:")
    print(entities)
    
    context = nlp.get_context_string(entities)
    print(f"\nContext String:\n{context}")
    
    if "Elon Musk" in entities.get("PERSON", []) and "Tesla" in entities.get("ORG", []):
        print("\n✅ Verification SUCCESS: Entities detected correctly.")
    else:
        print("\n❌ Verification FAILED: Missing expected entities.")
        
except Exception as e:
    print(f"\n❌ Error during verification: {e}")
