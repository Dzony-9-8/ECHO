# gui_app.py
import tkinter as tk
from tkinter import scrolledtext, ttk, messagebox, filedialog
import threading
import queue
import time
from datetime import datetime
import json
import requests

class EmotionalAIGUI:
    def __init__(self, root):
        self.root = root
        self.root.title("ECHO - Emotional AI Assistant")
        self.root.geometry("900x700")
        self.root.configure(bg="#f0f0f0")
        
        # API Configuration
        self.api_url = "http://127.0.0.1:8002"
        self.session_id = f"gui_{int(time.time())}"
        
        # Response queue for thread-safe GUI updates
        self.response_queue = queue.Queue()
        
        # Setup UI
        self.setup_ui()
        
        # Start queue checker
        self.check_queue()
        
        # Welcome message
        self.add_system_message("ECHO is ready. Information retrieval and emotional intelligence active.")
    
    def setup_ui(self):
        # Configure styles
        self.style = ttk.Style()
        self.style.configure('Title.TLabel', font=('Arial', 18, 'bold'), background='#f0f0f0')
        self.style.configure('Emotion.TLabel', font=('Arial', 10), background='#f0f0f0')
        
        # Main container
        main_frame = ttk.Frame(self.root, padding="10")
        main_frame.grid(row=0, column=0, sticky=(tk.W, tk.E, tk.N, tk.S))
        
        # Configure grid weights
        self.root.columnconfigure(0, weight=1)
        self.root.rowconfigure(0, weight=1)
        main_frame.columnconfigure(0, weight=1)
        main_frame.rowconfigure(1, weight=1)
        
        # Title frame
        title_frame = ttk.Frame(main_frame)
        title_frame.grid(row=0, column=0, columnspan=2, pady=(0, 10), sticky=(tk.W, tk.E))
        
        # Title
        title_label = ttk.Label(title_frame, text="🧠 ECHO AI Assistant", 
                                style='Title.TLabel')
        title_label.pack(side=tk.LEFT)
        
        # Emotion indicator
        self.emotion_frame = ttk.Frame(title_frame)
        self.emotion_frame.pack(side=tk.RIGHT, padx=10)
        
        self.emotion_label = ttk.Label(self.emotion_frame, text="Emotion: Neutral", 
                                      style='Emotion.TLabel')
        self.emotion_label.pack()
        
        self.emotion_color = tk.Label(self.emotion_frame, text="●", font=('Arial', 16), 
                                     fg="gray", bg="#f0f0f0")
        self.emotion_color.pack()
        
        # Conversation area with scrollbar
        chat_frame = ttk.Frame(main_frame)
        chat_frame.grid(row=1, column=0, columnspan=2, pady=(0, 10), sticky=(tk.W, tk.E, tk.N, tk.S))
        chat_frame.columnconfigure(0, weight=1)
        chat_frame.rowconfigure(0, weight=1)
        
        # Create custom tags for different message types
        self.conversation_area = scrolledtext.ScrolledText(
            chat_frame,
            wrap=tk.WORD,
            width=80,
            height=25,
            font=('Segoe UI', 11),
            bg='white',
            relief=tk.FLAT,
            borderwidth=1
        )
        self.conversation_area.grid(row=0, column=0, sticky=(tk.W, tk.E, tk.N, tk.S))
        
        # Configure tags for different message types
        self.conversation_area.tag_config('user', foreground='#0056b3', font=('Segoe UI', 11, 'bold'))
        self.conversation_area.tag_config('ai', foreground='#1e7e34', font=('Segoe UI', 11))
        self.conversation_area.tag_config('system', foreground='gray', font=('Segoe UI', 9, 'italic'))
        self.conversation_area.tag_config('error', foreground='red', font=('Segoe UI', 10))
        
        # Input frame
        input_frame = ttk.Frame(main_frame)
        input_frame.grid(row=2, column=0, sticky=(tk.W, tk.E), pady=(0, 10))
        input_frame.columnconfigure(0, weight=1)
        
        # Input field with placeholder
        self.user_input = tk.Text(input_frame, height=3, width=60, font=('Segoe UI', 11),
                                 relief=tk.FLAT, borderwidth=1, wrap=tk.WORD, bg='#f8f9fa')
        self.user_input.grid(row=0, column=0, sticky=(tk.W, tk.E), padx=(0, 10))
        
        # Set placeholder text
        self.placeholder_text = "Type your message here... (Press Shift+Enter for new line, Enter to send)"
        self.user_input.insert('1.0', self.placeholder_text)
        self.user_input.tag_add('placeholder', '1.0', 'end')
        self.user_input.tag_config('placeholder', foreground='gray')
        
        # Bind events for placeholder and keys
        self.user_input.bind('<FocusIn>', self.on_input_focus_in)
        self.user_input.bind('<FocusOut>', self.on_input_focus_out)
        self.user_input.bind('<Return>', self.on_enter_key)
        self.user_input.bind('<Shift-Return>', self.on_shift_enter)
        
        # Button frame
        button_frame = ttk.Frame(main_frame)
        button_frame.grid(row=2, column=1, sticky=(tk.E, tk.W), pady=(0, 10))
        
        # Send button
        self.send_button = ttk.Button(button_frame, text="Send", 
                                     command=self.send_message, 
                                     width=10)
        self.send_button.pack(side=tk.LEFT, padx=2)
        
        # Clear button
        clear_button = ttk.Button(button_frame, text="Clear", 
                                 command=self.clear_conversation,
                                 width=10)
        clear_button.pack(side=tk.LEFT, padx=2)
        
        # Status bar
        status_frame = ttk.Frame(main_frame)
        status_frame.grid(row=3, column=0, columnspan=2, sticky=(tk.W, tk.E))
        
        self.status_label = ttk.Label(status_frame, text="Ready", relief=tk.SUNKEN, anchor=tk.W)
        self.status_label.pack(fill=tk.X, ipady=2)
        
        # Menu bar
        self.setup_menu()
        
        # Configure column weights
        main_frame.columnconfigure(0, weight=3)
        main_frame.columnconfigure(1, weight=1)
    
    def setup_menu(self):
        menubar = tk.Menu(self.root)
        self.root.config(menu=menubar)
        
        # File menu
        file_menu = tk.Menu(menubar, tearoff=0)
        menubar.add_cascade(label="File", menu=file_menu)
        file_menu.add_command(label="Export Conversation", command=self.export_conversation)
        file_menu.add_separator()
        file_menu.add_command(label="Exit", command=self.root.quit)
        
        # Session menu
        session_menu = tk.Menu(menubar, tearoff=0)
        menubar.add_cascade(label="Session", menu=session_menu)
        session_menu.add_command(label="New Session", command=self.new_session)
        
        # Help menu
        help_menu = tk.Menu(menubar, tearoff=0)
        menubar.add_cascade(label="Help", menu=help_menu)
        help_menu.add_command(label="About", command=self.show_about)
    
    def on_input_focus_in(self, event):
        """Handle focus in event for input field"""
        if self.user_input.get('1.0', 'end-1c') == self.placeholder_text:
            self.user_input.delete('1.0', tk.END)
            self.user_input.tag_remove('placeholder', '1.0', 'end')
    
    def on_input_focus_out(self, event):
        """Handle focus out event for input field"""
        if not self.user_input.get('1.0', 'end-1c').strip():
            self.user_input.insert('1.0', self.placeholder_text)
            self.user_input.tag_add('placeholder', '1.0', 'end')
    
    def on_enter_key(self, event):
        """Handle Enter key press"""
        if not event.state & 0x1:  # If Shift is not pressed
            self.send_message()
            return 'break'  # Prevent default behavior
        return None
    
    def on_shift_enter(self, event):
        """Handle Shift+Enter for new line"""
        self.user_input.insert(tk.INSERT, '\n')
        return 'break'
    
    def send_message(self):
        """Send user message to assistant"""
        # Get user input
        user_text = self.user_input.get('1.0', 'end-1c').strip()
        
        # Skip if empty or placeholder
        if not user_text or user_text == self.placeholder_text:
            return
        
        # Clear input field
        self.user_input.delete('1.0', tk.END)
        self.user_input.focus_set()
        
        # Display user message
        self.display_message(f"You: {user_text}", "user")
        
        # Update status
        self.update_status("Processing... (This might take a moment if searching online)")
        
        # Process in background thread
        thread = threading.Thread(target=self.process_response, args=(user_text,))
        thread.daemon = True
        thread.start()
    
    def process_response(self, user_text):
        """Process user message and get AI response via API"""
        try:
            payload = {
                "message": user_text,
                "session_id": self.session_id
            }
            response = requests.post(f"{self.api_url}/chat", json=payload, timeout=120)
            
            if response.status_code == 200:
                data = response.json()
                response_text = data.get('response', '')
                emotion = data.get('emotion', 'neutral')
                confidence = data.get('confidence', 0.0)
                
                # Update session id if returned by server
                if data.get('session_id'):
                    self.session_id = data['session_id']
                
                # Get emotion color
                emotion_colors = {
                    "very_negative": "red",
                    "negative": "orange",
                    "neutral": "gray",
                    "positive": "blue",
                    "very_positive": "green"
                }
                color = emotion_colors.get(emotion, "gray")
                
                # Put results in queue for thread-safe GUI update
                self.response_queue.put({
                    'response': response_text,
                    'emotion': emotion,
                    'color': color,
                    'confidence': confidence
                })
            else:
                 self.response_queue.put({
                    'error': f"Server returned error: {response.status_code}"
                })
            
        except requests.exceptions.ConnectionError:
            self.response_queue.put({
                'error': "Could not connect to backend. Is main.py running?"
            })
        except Exception as e:
            self.response_queue.put({
                'error': f"Error: {str(e)}"
            })
    
    def check_queue(self):
        """Check for responses in queue and update GUI"""
        try:
            while True:
                result = self.response_queue.get_nowait()
                
                if 'error' in result:
                    self.display_message(f"System: {result['error']}", "error")
                    self.update_status("Error")
                else:
                    # Update emotion indicator
                    self.update_emotion_indicator(result['emotion'], result['color'], result['confidence'])
                    
                    # Display AI response
                    self.display_message(f"Assistant: {result['response']}", "ai")
                    
                    # Update status
                    self.update_status("Ready")
                
                # Scroll to bottom
                self.conversation_area.see(tk.END)
                
        except queue.Empty:
            pass
        
        # Check again after 100ms
        self.root.after(100, self.check_queue)
    
    def display_message(self, message, sender):
        """Display a message in the conversation area"""
        self.conversation_area.config(state=tk.NORMAL)
        
        # Add timestamp
        timestamp = datetime.now().strftime("%H:%M:%S")
        self.conversation_area.insert(tk.END, f"[{timestamp}] ", 'system')
        
        # Add message with appropriate tag
        self.conversation_area.insert(tk.END, f"{message}\n\n", sender)
        
        self.conversation_area.config(state=tk.DISABLED)
        self.conversation_area.see(tk.END)
    
    def add_system_message(self, message):
        """Add a system message to the conversation"""
        self.conversation_area.config(state=tk.NORMAL)
        self.conversation_area.insert(tk.END, f"[System] {message}\n\n", 'system')
        self.conversation_area.config(state=tk.DISABLED)
        self.conversation_area.see(tk.END)
    
    def update_emotion_indicator(self, emotion, color, confidence):
        """Update the emotion indicator"""
        emotion_display = emotion.replace('_', ' ').title()
        confidence_text = f"{abs(confidence):.2f}"
        
        self.emotion_label.config(text=f"Emotion: {emotion_display} ({confidence_text})")
        self.emotion_color.config(fg=color)
    
    def update_status(self, message):
        """Update the status bar"""
        self.status_label.config(text=f"Status: {message}")
    
    def clear_conversation(self):
        """Clear the conversation display"""
        if messagebox.askyesno("Clear Conversation", "Are you sure you want to clear the conversation display?"):
            self.conversation_area.config(state=tk.NORMAL)
            self.conversation_area.delete('1.0', tk.END)
            self.conversation_area.config(state=tk.DISABLED)
            self.add_system_message("Conversation cleared.")
    
    def export_conversation(self):
        """Export conversation to file"""
        filename = filedialog.asksaveasfilename(
            defaultextension=".txt",
            filetypes=[("Text files", "*.txt"), ("All files", "*.*")],
            initialfile=f"conversation_{datetime.now().strftime('%Y%m%d_%H%M%S')}.txt"
        )
        
        if filename:
            try:
                conversation = self.conversation_area.get('1.0', tk.END)
                with open(filename, 'w', encoding='utf-8') as f:
                    f.write("ECHO AI Assistant Conversation Export\n")
                    f.write("=" * 50 + "\n")
                    f.write(f"Export Date: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")
                    f.write("=" * 50 + "\n\n")
                    f.write(conversation)
                
                self.add_system_message(f"Conversation exported to: {filename}")
                messagebox.showinfo("Export Successful", f"Conversation exported to:\n{filename}")
                
            except Exception as e:
                messagebox.showerror("Export Error", f"Failed to export conversation:\n{str(e)}")
    
    def new_session(self):
        """Start a new conversation session request"""
        if messagebox.askyesno("New Session", "Start a new conversation session? This will reset Echo's short-term memory."):
            try:
                requests.post(f"{self.api_url}/memory/clear")
                self.clear_conversation()
                self.add_system_message("Started new conversation session.")
                self.update_emotion_indicator("neutral", "gray", 0.0)
            except:
                self.display_message("Failed to reset session on server", "error")

    def show_about(self):
        """Show about dialog"""
        about_text = """ECHO AI Assistant
        
Powered by:
- Ollama (LLM)
- Emotional Intelligence Engine
- Web Search & Real-time Data
- Python & FastAPI

ECHO is designed to be caring, accurate, and helpful.
"""
        messagebox.showinfo("About ECHO", about_text)

def main():
    """Main function to run the application"""
    root = tk.Tk()
    
    app = EmotionalAIGUI(root)
    
    # Center window on screen
    root.update_idletasks()
    width = root.winfo_width()
    height = root.winfo_height()
    x = (root.winfo_screenwidth() // 2) - (width // 2)
    y = (root.winfo_screenheight() // 2) - (height // 2)
    root.geometry(f'{width}x{height}+{x}+{y}')
    
    root.mainloop()

if __name__ == "__main__":
    main()
