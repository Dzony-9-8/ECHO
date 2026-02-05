# ECHO AI - Quick Start Guide

## ✅ Frontend is Now Running

Your Vite dev server is running at: **<http://localhost:5173>**

## 🎯 Testing the Edit Button

1. **Open your browser** and go to: <http://localhost:5173>
2. **Send a test message** (e.g., "hello")
3. **Hover your mouse** over the message you just sent
4. **Look for "✎ Edit"** button in the top-right corner of the message bubble
5. **Click it** to edit your message

## 🔧 If You Still Don't See It

### Option 1: Hard Refresh

Press `Ctrl + Shift + R` or `Ctrl + F5` to clear browser cache

### Option 2: Check Browser Console

1. Press `F12` to open DevTools
2. Go to **Console** tab
3. Look for any errors (red text)
4. Take a screenshot and share it with me

### Option 3: Inspect the Element

1. Right-click on a user message
2. Click "Inspect" or "Inspect Element"
3. Look for `<div class="message-actions">` in the HTML
4. Check if it has `display: none` in the Styles panel
5. Hover over the message and see if it changes to `display: flex`

## 📝 Expected Behavior

When you **hover** over a user message:

- A button labeled "✎ Edit" should appear in the **top-right corner**
- It has a **semi-transparent gray background**
- Clicking it opens a **textarea** with Save & Cancel buttons

## 🚀 Starting the Backend

If you haven't started the backend yet:

```cmd
cd D:\AI\Yui
python -m backend.main
```

## 📞 Need Help?

If the Edit button still doesn't appear:

1. Open <http://localhost:5173> in your browser
2. Press F12 (DevTools)
3. Send a message
4. Take a screenshot showing:
   - The chat interface
   - The Console tab (for errors)
   - The Elements tab (showing the message HTML)
