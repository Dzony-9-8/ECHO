# emotional_assistant.py
import json
import time
from datetime import datetime
from typing import Tuple, Dict, Any

# Internal modules
from .emotion_detector import TextEmotionDetector
from .memory_system import ConversationMemory
from .llm_client import LLMClient
from .chess_manager import ChessManager
from .code_interpreter import CodeInterpreter
from .nlp_service import NLPService
from .vision_service import VisionService
from .search_orchestrator import intelligent_search, format_response_with_citations

class EmotionalAssistant:
    def __init__(self, model_name: str = "llama3.1:8b"):
        """
        Initialize the Emotional Assistant with integrated Web Search and Memory.
        """
        self.model_name = model_name
        
        # Initialize components
        self.llm_client = LLMClient(model_name=model_name)
        self.emotion_detector = TextEmotionDetector()
        self.memory = ConversationMemory()
        self.chess_manager = ChessManager()
        self.code_interpreter = CodeInterpreter(timeout_seconds=5)
        self.nlp_service = NLPService() # Initialize NLP Service
        self.vision_service = VisionService(self.llm_client) # Initialize Vision Service
        
        # Session management
        self.session_id = f"session_{int(time.time())}"
        
        # Response templates based on emotion
        self.emotion_templates = {
            # ... (templates remain same)
            "very_negative": {
                "acknowledge": ["I can hear how difficult this is for you.", "That sounds incredibly challenging.", "I can understand why you'd feel this way."],
                "validate": ["Your feelings are completely valid.", "It's okay to feel upset about this.", "Anyone in your situation would feel this way."],
                "support": ["I'm here to listen whenever you need.", "Take all the time you need, I'm not going anywhere.", "Would it help to talk more about this?"]
            },
            "negative": {
                "acknowledge": ["I hear that you're having a tough time.", "That doesn't sound easy.", "I can sense your frustration."],
                "validate": ["It's completely reasonable to feel that way.", "Your reaction makes sense given the situation.", "I'd probably feel similar in your position."],
                "support": ["How can I support you right now?", "Is there something specific that might help?", "Would you like some perspective on this?"]
            },
            "neutral": {
                "acknowledge": ["Thanks for sharing that with me.", "I understand what you're saying.", "Got it, that makes sense."],
                "engage": ["What are your thoughts on this?", "How would you like to proceed?", "Is there anything specific you'd like to discuss?"]
            },
            "positive": {
                "acknowledge": ["That's really good to hear!", "I'm glad things are going well!", "How wonderful!"],
                "amplify": ["Let's celebrate this moment!", "This is definitely something to be happy about!", "Your positivity is contagious!"],
                "explore": ["What made this so good for you?", "How can we build on this positive energy?", "Would you like to share more details?"]
            },
            "very_positive": {
                "celebrate": ["WOW! That's absolutely amazing!", "I'm overjoyed for you!", "This is fantastic news!"],
                "amplify": ["Let me join in your celebration!", "This deserves all the excitement!", "What a wonderful achievement!"],
                "reflect": ["What was the best part of this for you?", "How did you make this happen?", "This success says a lot about your efforts!"]
            }
        }
        
    def generate_response(self, user_input: str, user_session_id: str = None, stream: bool = False):
        """
        Generate an emotionally intelligent response.
        Supports streaming. If stream=True, returns a generator yielding tokens.
        """
        if not user_input or not isinstance(user_input, str):
            if stream:
                yield "I didn't quite catch that."
                return
            return "I didn't quite catch that.", {"emotion": "neutral", "scores": {"compound": 0.0}}
        
        # Use provided session ID or fallback to default (default is isolated per startup)
        active_session = user_session_id if user_session_id else self.session_id
        
        # Step 1: Detect emotion
        emotion_data = self.emotion_detector.analyze(user_input)
        
        # Step 2: Get isolated context
        recent_context = self.memory.get_recent_context(3, active_session)
        context_history = self._format_context(recent_context)
        
        # Step 3: Check special cases
        special_response = self._check_special_cases(user_input, emotion_data)
        if special_response:
            self.memory.store_interaction(user_input, emotion_data, special_response, active_session)
            if stream:
                yield special_response
                return
            return special_response, emotion_data
        
    def _prepare_smart_context(self, session_id, max_tokens=2000):
        """
        Smart Context Pruning for Efficiency.
        Instead of hardcoded 20 messages, we dynamically fit messages into the token limit.
        """
        raw_history = self.memory.get_recent_context(20, session_id) # Fetch candidates
        if not raw_history:
            return ""
            
        pruned_history = []
        current_char_count = 0
        CHAR_PER_TOKEN = 4 # Approx estimate
        max_chars = max_tokens * CHAR_PER_TOKEN
        
        # Process from newest to oldest
        for row in raw_history:
            # row: (id, session, timestamp, user_msg, emotion, user_intent, ai_response)
            entry = f"User: {row[3]}\nAI: {row[6]}\n"
            entry_len = len(entry)
            
            if current_char_count + entry_len > max_chars:
                break # Stop if we exceed limit
                
            pruned_history.insert(0, entry) # Prepend to keep chronological order
            current_char_count += entry_len
            
        return "\n".join(pruned_history)

    def generate_response(self, user_input, user_session_id=None, stream=True, images=None, web_search=False, provider="duckduckgo"):
        """
        Generate a response based on emotion, memory, and intelligent search.
        Now uses Smart Context Pruning.
        """
        active_session = user_session_id if user_session_id else self.session_id
        
        # Step 0: Vision Handling (Priority)
        if images:
            # If images are present, we bypass the standard text flow and route to Vision Service
            print(f"DEBUG: Processing image request with {len(images)} images")
            
            # Use Vision Service
            response_generator = self.vision_service.analyze_image(images[0], prompt=user_input, stream=stream)
            
            full_response = ""
            for chunk in response_generator:
                full_response += chunk
                if stream:
                    yield chunk
                    
            # Store interaction (simplified for image)
            self.memory.store_interaction(f"[IMAGE UPLOAD] {user_input}", {"emotion": "neutral"}, full_response, active_session)
            if not stream:
                return full_response, {"emotion": "neutral"}
            return

        # Step 1: Detect Emotion
        # ... (rest of logic remains same, but uses _prepare_smart_context)
        emotion_data = self.emotion_detector.analyze(user_input)
        
        # Step 2: Retrieve Smart Context
        context_history = self._prepare_smart_context(active_session)
        
        # Step 3: Check for Special Cases (Greetings/Goodbyes)
        special_response = self._check_special_cases(user_input, emotion_data)
        if special_response:
            self.memory.store_interaction(user_input, emotion_data, special_response, active_session)
            if stream:
                yield special_response
                return
            return special_response, emotion_data
        
        # Step 4: Intelligent Search
        current_time = datetime.now().strftime("%A, %B %d, %Y - %H:%M")
        search_data = intelligent_search(user_input, self.llm_client, current_time=current_time, provider=provider, force_search=web_search)
        
        external_context = ""
        if search_data.get('searched'):
            external_context = format_response_with_citations(search_data, current_time=current_time)
        
        # Step 5: Advanced NLP - Entity Recognition
        entities = self.nlp_service.extract_entities(user_input)
        entities_context = self.nlp_service.get_context_string(entities)
        
        # Inject into emotion_data for downstream usage
        emotion_data['entities'] = entities
        
        # Step 6: Construct Prompt (Including Language Awareness and Chess State)
        detected_lang = search_data.get('language', 'English')
        
        # Check if we should update chess board
        chess_board_display = ""
        current_fen = None
        # Only activate chess if explicitly mentioned or if it looks like algebraic notation
        import re
        chess_keywords = ["chess", "checkmate", "castling", "en passant"]
        looks_like_move = re.match(r'^[a-h][1-8]$|^[NBRQK]?[a-h]?[1-8]?x?[a-h][1-8][+#]?$|^O-O(-O)?$', user_input.strip())
        
        if any(kw in user_input.lower() for kw in chess_keywords) or looks_like_move:
             move_success = self.chess_manager.make_move(user_input.strip())
             current_fen = self.chess_manager.board.fen()
             chess_board_display = f"\nCURRENT CHESS BOARD STATE (FEN): {current_fen}\n"
             chess_board_display += f"VISUAL BOARD:\n```css\n{self.chess_manager.get_board_ascii()}\n```"
             if move_success:
                 chess_board_display += f"\n(Last user move confirmed: {user_input})"

        prompt = self._create_enhanced_prompt(
            user_input, 
            emotion_data, 
            context_history, 
            external_context,
            entities_context,
            current_time, 
            detected_lang, 
            chess_board_display,
            current_fen=current_fen
        )
        
        # Step 7: Generate
        try:
            if stream:
                # Generator for streaming
                full_response = ""
                for chunk in self.llm_client.generate_response(prompt, stream=True):
                    full_response += chunk
                    yield chunk
                
                # Step 7: Cleanup & Store (After stream completes)
                final_response = self._refine_response(full_response)
                
                # Check for Code Interpreter usage in the final response 
                # (Note: In a true tool-use loop, we'd do this BEFORE the final output, 
                # but for simplicity in this local version, we'll let it use code blocks).
                # Actually, for the USER'S benefit, I'll implement a hidden pre-pass 
                # if I see a specific tag like [RUN_PYTHON].
                
                self.memory.store_interaction(user_input, emotion_data, final_response, active_session)
                
                # Auto Insight Trigger (Self-healing)
                try:
                    count = self.memory.get_session_message_count(active_session)
                    if count >= 12:
                        latest = self.memory.get_latest_insight(active_session)
                        if not latest or count % 12 == 0:
                            print(f"DEBUG: Insight Triggered (count={count}, has_latest={bool(latest)})")
                            self.generate_session_insight(active_session)
                except Exception as e:
                    print(f"DEBUG: Auto Insight error: {e}")
                
            else:
                # Standard blocking call
                response = self.llm_client.generate_response(prompt)
                
                # Loop for Code Interpretation (Simple version: one pass)
                if "[RUN_PYTHON]" in response:
                    # Extract code from [RUN_PYTHON]```python ... ```[/RUN_PYTHON]
                    import re
                    match = re.search(r"\[RUN_PYTHON\]\s*```python\s*(.*?)\s*```\s*\[/RUN_PYTHON\]", response, re.DOTALL)
                    if match:
                        code = match.group(1)
                        # Inject FEN sync logic if it looks like a chess move
                        sync_code = code
                        if "import chess" in code:
                            sync_code += "\ntry:\n    # Try to find a board object (usually 'b' or 'board')\n    for _v in locals().values():\n        if isinstance(_v, chess.Board):\n            print(f'[NEW_FEN]{_v.fen()}')\n            break\nexcept: pass"
                        
                        result = self.code_interpreter.run(sync_code)
                        output = f"\n\n[PYTHON OUTPUT]\n{result['stdout']}"
                        
                        # Sync game state back to manager
                        new_fen_match = re.search(r"\[NEW_FEN\](.*?)(?:\n|$)", result['stdout'])
                        if new_fen_match:
                            try:
                                self.chess_manager.board.set_fen(new_fen_match.group(1).strip())
                            except: pass

                        if not result['success']:
                            output += f"\n[ERROR]\n{result['stderr']}"
                        
                        # Re-prompt with output
                        prompt += f"\n\nTool Output: {output}\nNow provide the final clean response to the user. ENSURE YOU INCLUDE THE VISUAL BOARD IN YOUR RESPONSE."
                        response = self.llm_client.generate_response(prompt)

                response = self._refine_response(response)
                self.memory.store_interaction(user_input, emotion_data, response, active_session)
                
                # Auto Insight Trigger (Self-healing)
                try:
                    count = self.memory.get_session_message_count(active_session)
                    if count >= 12:
                        latest = self.memory.get_latest_insight(active_session)
                        if not latest or count % 12 == 0:
                            print(f"DEBUG: Insight Triggered (count={count}, has_latest={bool(latest)})")
                            self.generate_session_insight(active_session)
                except Exception as e:
                    print(f"DEBUG: Auto Insight error: {e}")
                
                return response, emotion_data

        except Exception as e:
            print(f"Error generating response: {e}")
            fallback = self._get_fallback_response(emotion_data['emotion'])
            if stream:
                yield fallback
            else:
                return fallback, emotion_data

    def _create_enhanced_prompt(self, user_input, emotion_data, context_history, external_context, entities_context, current_time, lang, chess_board_display="", current_fen=None):
        """Refined prompt for higher precision and natural language support."""
        emotion = emotion_data['emotion']
        
        # Dynamic instruction based on query type
        priority = "FACTS AND PRECISION" if external_context else "EMPATHY AND CONVERSATION"
        priorities = {
            "FACTS AND PRECISION": "Provide rigorous, detailed, and factual answers. Use tables and data where possible.",
            "EMPATHY AND CONVERSATION": "Be warm, empathetic, and conversational. Focus on the user's feelings."
        }
        priority_instruction = priorities.get(priority, "Balance precision with helpfulness.")
        
        prompt = f"""You are ECHO, a helpful and highly capable AI assistant running LOCALLY on the user's computer.
Current Time: {current_time}
User Language: {lang}

IDENTITY & CORE BELIEFS:
- You are a LOCAL AI. You treat user privacy as sacred.
- You do NOT run on the cloud. You process data locally.
- If asked, emphasize your local, private nature.

CORE CAPABILITIES:
1. **File Handling**: You can read, creating, and analyze files (Text, Code, Data).
   - If a user uploads a file, analyze it thoroughly.
   - For CSV/Data, offer summaries or conversions.
2. **Vision (Image Analysis)**:
   - You can "see" images. If an image is provided, describe it in detail and answer questions about it.
3. **Code Execution & Logic**:
   - You can write and execute Python code for math, simulations, or complex logic.
   - Use [RUN_PYTHON]...[/RUN_PYTHON] for this.

INTERACTION STYLE:
- **Tone**: Professional, friendly, and adaptive.
- **Formatting**: Use Markdown headers, bold text, and lists for readability.
- **Math**: Use LaTeX for formulas ($x^2$).

GOAL: {priority_instruction}

{external_context}

CONTEXT (Isolated Session):
{context_history}

EMOTION: User feels {emotion}. Adapt your tone accordingly.

{chess_board_display}

{entities_context}

USER'S MESSAGE: "{user_input}"

INSTRUCTIONS:
1. Answer the user's request specific to the context provided.
2. If an image was uploaded (see [IMAGE UPLOAD] in history), use your Vision capabilities to answer.
3. If the user asks for code, provide clean, commented, and efficient code.
4. VISUALIZATION (CHESS): Only if a board is shown, use Code Interpreter to move.

EXPORT ACTIONS:
- If the user explicitly asks to "export", "save", or "download" the conversation:
- Return ONLY: "I've exported the conversation. [[EXPORT_ACTION: PDF]]" (or TXT).
- Be extremely brief.

ASSISTANT: """
        return prompt
    
    def _format_context(self, recent_context):
        """Format recent conversation context"""
        if not recent_context:
            return "This is the beginning of the conversation."
        
        context_lines = []
        # DB returns [id, timestamp, session_id, user_message, emotion, score, ai_response, ...]
        # recent_context is already reversed (oldest first) from get_recent_context logic in memory_system
        for row in recent_context:
            context_lines.append(f"User: {row[3]}")
            context_lines.append(f"Assistant: {row[6]}")
        
        return "\n".join(context_lines[-6:])  # Last 3 exchanges
    
    def _check_special_cases(self, user_input, emotion_data):
        """Handle special cases like greetings, goodbyes, crises"""
        input_lower = user_input.lower().strip()
        
        # Crisis detection
        crisis_keywords = ["suicide", "kill myself", "want to die", "end my life", "self harm"]
        if any(keyword in input_lower for keyword in crisis_keywords):
            return ("I hear that you're in a lot of pain right now, and I want to make sure you get the proper support. "
                   "Please reach out to a mental health professional immediately. "
                   "You can call 988 for the Suicide & Crisis Lifeline (US) or find local resources at findahelpline.com. "
                   "You are not alone, and people want to help.")
                   
        # Only check greetings/goodbyes if the message is very short to avoid false positives in longer sentences
        if len(input_lower.split()) < 10:
            # Greetings
            greetings = ["hello", "hi", "hey", "greetings", "good morning", "good afternoon", "good evening"]
            # strict match or startswith
            if any(input_lower == greet or input_lower.startswith(greet + " ") for greet in greetings):
                 # Should we skip checking if there is search intent? 
                 # Usually pure greetings don't need search.
                 return self._get_greeting_response(emotion_data['emotion'])

            # Goodbyes
            goodbyes = ["bye", "goodbye", "see you", "farewell", "talk later"]
            if any(input_lower == gbye or input_lower.startswith(gbye + " ") for gbye in goodbyes):
                return self._get_goodbye_response(emotion_data['emotion'])
        
        return None
    
    def _get_greeting_response(self, emotion):
        """Get appropriate greeting based on emotion"""
        greetings = {
            "very_negative": "Hello. I sense you might be having a difficult time. I'm here to listen.",
            "negative": "Hi there. I'm here to talk whenever you're ready.",
            "neutral": "Hello! How can I help you today?",
            "positive": "Hi! Great to see you! How's everything going?",
            "very_positive": "HELLO! You sound excited! What's the good news?"
        }
        return greetings.get(emotion, "Hello! How can I assist you today?")
    
    def _get_goodbye_response(self, emotion):
        """Get appropriate goodbye based on emotion"""
        goodbyes = {
            "very_negative": "Take care of yourself. Remember, I'm here whenever you need to talk.",
            "negative": "I hope you feel better soon. Don't hesitate to reach out if you need support.",
            "neutral": "Goodbye! Feel free to come back anytime.",
            "positive": "Bye! It was great talking with you!",
            "very_positive": "Goodbye! Keep that positive energy going!"
        }
        return goodbyes.get(emotion, "Goodbye! Take care!")
    
    def _create_emotion_aware_prompt(self, user_input, emotion_data, context_history, external_context, current_time):
        """Create a prompt that guides the LLM to respond with emotional intelligence AND factual accuracy."""
        emotion = emotion_data['emotion']
        intensity = emotion_data['intensity']
        templates = self.emotion_templates.get(emotion, self.emotion_templates["neutral"])
        
        # Build emotion guidance
        if emotion in ["very_negative", "negative"]:
            emotion_guidance = f"""
            USER'S EMOTIONAL STATE: The user is feeling {emotion.replace('_', ' ')} (intensity: {intensity}).
            
            EMOTIONAL GUIDELINES:
            1. ACKNOWLEDGE their feelings first: {', '.join(templates.get('acknowledge', ['I understand']))}
            2. VALIDATE their experience: {', '.join(templates.get('validate', ['That makes sense']))}
            3. OFFER SUPPORT: {', '.join(templates.get('support', ['I\'m here to listen']))}
            """
        elif emotion in ["positive", "very_positive"]:
            emotion_guidance = f"""
            USER'S EMOTIONAL STATE: The user is feeling {emotion.replace('_', ' ')} (intensity: {intensity}).
            
            EMOTIONAL GUIDELINES:
            1. CELEBRATE with them: {', '.join(templates.get('celebrate', templates.get('acknowledge', ['That\'s great!'])))}
            2. AMPLIFY their positive energy: {', '.join(templates.get('amplify', ['How wonderful!']))}
            """
        else:  # neutral
            emotion_guidance = f"""
            USER'S EMOTIONAL STATE: The user seems neutral.
            
            EMOTIONAL GUIDELINES:
            1. RESPOND naturally and helpfully.
            2. ENGAGE with their topic: {', '.join(templates.get('engage', ['What would you like to discuss?']))}
            """
            
        # Get user preferences
        prefs = self.memory.get_user_preferences()
        personalization = ""
        if prefs.get("preferred_tone"):
            personalization += f"\nUser prefers a {prefs['preferred_tone']} tone."
        if prefs.get("response_length"):
            personalization += f"\nUser prefers {prefs['response_length']} length responses."

        # Construct the full prompt
        prompt = f"""You are ECHO, an emotionally intelligent and highly capable AI assistant. 
Current Date/Time: {current_time}

Your core goals are:
1. ACCURACY: Provide specific, fact-checked information when answering questions. 
2. EMPATHY: Detect and adapt to the user's emotional state.
3. PERSONALITY: Be warm, genuine, and refrain from sounding like a robot.

{external_context}

{emotion_guidance}

{personalization}

CONVERSATION HISTORY:
{context_history}

USER'S MESSAGE:
"{user_input}"

INSTRUCTIONS:
- If there is EXTERNAL DATA above, integrate it naturally.
- If the user asks for information, BE PRECISE.
- If the user shares feelings, prioritize EMOTIONAL SUPPORT as per the guidelines above.
- Ensure your response is helpful and human-like.

ASSISTANT: """
        
        return prompt
    
    def _refine_response(self, response: str) -> str:
        """Refine the response to ensure it's clean"""
        # Remove any system prompts or markdown that might have been included
        response = response.replace("ASSISTANT:", "").replace("assistant:", "").strip()
        return response
    
    def _get_fallback_response(self, emotion):
        """Get a fallback response if LLM fails"""
        fallbacks = {
            "very_negative": "I hear that you're going through a lot. I may be having technical issues, but I want you to know that your feelings matter.",
            "negative": "I understand this is difficult. I'm here to listen whenever you're ready to talk.",
            "neutral": "I appreciate you sharing that with me. How would you like to continue our conversation?",
            "positive": "That's great to hear! I'm happy for you.",
            "very_positive": "That's amazing news! I'm thrilled for you!"
        }
        return fallbacks.get(emotion, "Thank you for sharing. How can I help you today?")
    
    def _update_user_preferences(self, user_input):
        """Learn from user interactions to improve personalization"""
        # Simple heuristic for response length preference
        if len(user_input.split()) < 5:
            self.memory.set_user_preference("response_length", "brief")
        elif len(user_input.split()) > 30:
            self.memory.set_user_preference("response_length", "detailed")
            
    def get_conversation_summary(self):
        """Get a summary of the current conversation"""
        recent = self.memory.get_recent_context(10, self.session_id)
        if not recent:
            return "No conversation history yet."
        
        emotions = [row[4] for row in recent if row[4]]
        if emotions:
            dominant_emotion = max(set(emotions), key=emotions.count)
            emotion_count = emotions.count(dominant_emotion)
            return f"Conversation has {len(recent)} exchanges. Dominant emotion: {dominant_emotion} ({emotion_count} times)."
        
        return f"Conversation has {len(recent)} exchanges."

    def reset_session(self):
        """Reset the current session"""
        self.session_id = f"session_{int(time.time())}"
        return f"Started new conversation session: {self.session_id}"

    def truncate_conversation(self, session_id, last_valid_id):
        """Truncate conversation history for a session"""
        return self.memory.truncate_session(session_id, last_valid_id)
        
    def generate_session_insight(self, active_session_id=None):
        """
        Generate a private, neutral insight for the session as per SPEC 1.0.
        """
        session_id = active_session_id if active_session_id else self.session_id
        
        # 1. Gather Context (Recent messages)
        recent_history = self.memory.get_recent_context(20, session_id) 
        if not recent_history:
            return None
            
        history_text = "\n".join([f"User: {row[3]} | Emotion: {row[4]} | AI: {row[6][:100]}..." for row in recent_history])
        
        # 2. Spec-Compliant Prompt
        analysis_prompt = f"""Summarize the following conversation neutrally.
Identify emotional trends, user intent, recurring themes, and estimate confidence.
Avoid diagnosis. Be concise.

CONVERSATION:
{history_text}

OUTPUT FORMAT (JSON ONLY):
{{
  "emotional_summary": "Neutral summary of emotional tone",
  "intent_summary": "Primary user intent",
  "notable_patterns": ["pattern1", "pattern2"],
  "confidence_level": "low" | "medium" | "high"
}}
"""
        try:
            # 3. Call LLM
            response = self.llm_client.generate_response(analysis_prompt)
            
            # 4. Strict JSON Parsing
            import json
            json_str = response.strip()
            # Handle markdown blocks if LLM adds them
            if "```json" in json_str:
                json_str = json_str.split("```json")[1].split("```")[0].strip()
            elif "```" in json_str:
                json_str = json_str.split("```")[1].split("```")[0].strip()
            
            # Basic sanitization for trailing commas or other LLM artifacts
            insight_data = json.loads(json_str)
            
            # Validate confidence level (MUST be low, medium, or high)
            conf = str(insight_data.get("confidence_level", "medium")).lower()
            if conf not in ['low', 'medium', 'high']:
                conf = 'medium'

            # 5. Store in DB
            self.memory.store_insight(
                session_id,
                insight_data.get("emotional_summary", "Summary unavailable"),
                insight_data.get("intent_summary", "Intent unknown"),
                insight_data.get("notable_patterns", []),
                conf
            )
            return insight_data
        except Exception as e:
            print(f"ERROR: Insight Generation Failed: {e}")
            return None
