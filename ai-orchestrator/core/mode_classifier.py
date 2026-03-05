class ModeClassifier:
    def __init__(self, model):
        self.model = model

    def classify(self, user_input: str) -> str:
        """
        Classifies user intent into: assistant, developer, or research.
        Uses a prompt optimized for small-model classification.
        """
        prompt = f"""
        Classify the user's intent into exactly one of three categories:
        - assistant: Casual talk, general questions, life organization.
        - developer: Coding, debugging, Git operations, shell commands, project file modification.
        - research: Multi-step analysis, background discovery, "investigate deeply", exploration of new topics.

        User input: "{user_input}"
        
        Intent (one word only):
        """
        
        try:
            res = self.model(
                prompt, 
                max_tokens=10, 
                stop=["\n", "User:", "AI:"], 
                echo=False
            )
            classification = res["choices"][0]["text"].strip().lower()
            
            # Sanitization
            return next((mode for mode in ["assistant", "developer", "research"] if mode in classification), "assistant")
        except Exception as e:
            print(f"--- Warning: Mode classification failed ({e}), defaulting to assistant ---")
            return "assistant"
