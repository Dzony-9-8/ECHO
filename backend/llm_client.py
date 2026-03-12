import requests
import json
from typing import List, Dict, Optional

OLLAMA_URL = "http://127.0.0.1:11434/api/chat"

class LLMClient:
    def __init__(self, model_name: str = "llama3.1:8b"):
        self.model_name = model_name

    def chat(self, messages: List[Dict[str, str]], stream: bool = False):
        payload = {
            "model": self.model_name,
            "messages": messages,
            "stream": stream
        }
        
        try:
            response = requests.post(OLLAMA_URL, json=payload, stream=stream)
            response.raise_for_status()
            
            if stream:
                for line in response.iter_lines():
                    if line:
                        try:
                            json_response = json.loads(line)
                            if 'message' in json_response:
                                yield json_response['message']['content']
                            elif 'response' in json_response: # Fallback for some Ollama versions
                                yield json_response['response']
                        except json.JSONDecodeError:
                            continue
            else:
                data = response.json()
                return data.get("message", {}).get("content", "")
        except requests.exceptions.RequestException as e:
            if stream:
                yield f"Error communicating with Ollama: {e}"
            else:
                return f"Error communicating with Ollama: {e}"

    def generate_response(self, prompt: str, system_prompt: Optional[str] = None, history: List[Dict] = [], stream: bool = False, images: List[str] = None, model: str = None):
        messages = []
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        
        messages.extend(history)
        
        user_msg = {"role": "user", "content": prompt}
        if images:
            user_msg["images"] = images
            
        messages.append(user_msg)
        
        # Allow transient model override (e.g., switching to llava for vision)
        original_model = self.model_name
        if model:
            self.model_name = model
            
        try:
            return self.chat(messages, stream=stream)
        finally:
            self.model_name = original_model
