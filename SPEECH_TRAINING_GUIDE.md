# Speech Training & Accent Calibration Guide

## Overview

The AI assistant can learn your specific speech patterns and accent through a training mode. This helps improve accuracy when you speak naturally with your accent.

## How It Works

1. **Training Mode**: You go through a series of common phrases
2. **Pattern Learning**: The AI learns how you pronounce words vs. how they're written
3. **Automatic Correction**: Your speech is corrected before processing
4. **Context Enhancement**: The AI uses your patterns to better understand commands

## Starting Training

1. Open the AI Assistant (click the purple sparkles button)
2. Click the **"🎯 Train"** button in the header
3. Follow the prompts - you'll be asked to say ~20 common phrases
4. Speak naturally - don't try to "fix" your accent!

## Training Process

The training will show you phrases like:
- "Add new line"
- "Column"
- "W12 by 24"
- "5 pieces"
- "20 feet"

For each phrase:
1. The AI shows you the phrase
2. You say it naturally (with your accent)
3. The AI records how you said it
4. It learns the pattern and moves to the next phrase

## What Gets Learned

The AI learns:
- **Pronunciation patterns**: How you say words vs. standard pronunciation
- **Accent variations**: Regional or personal accent differences
- **Common mistakes**: What the speech-to-text gets wrong for you
- **Corrections**: Maps your speech to correct text

## How It Helps

### Before Training
```
You say: "Add new line" (with accent)
Speech-to-text hears: "Add new lion"
AI gets confused ❌
```

### After Training
```
You say: "Add new line" (with accent)
Speech-to-text hears: "Add new lion"
AI corrects: "Add new line" ✅
AI understands perfectly!
```

## Automatic Application

Once trained:
- Your speech patterns are **automatically applied** to all commands
- Corrections happen **before** the AI processes your command
- The AI also receives **context** about your speech patterns
- Patterns are **saved** and persist across sessions

## Retraining

You can retrain anytime:
- Click "🎯 Train" again
- Go through the phrases again
- New patterns will update your profile

## Privacy

- Speech patterns are stored **per project** in Firestore
- Only used to improve your experience
- Not shared with other users
- You can clear them anytime

## Tips for Best Results

1. **Speak naturally** - Don't try to "fix" your accent
2. **Use your normal voice** - Same volume and speed as when estimating
3. **Complete all phrases** - More training = better accuracy
4. **Retrain if needed** - If accuracy drops, retrain
5. **Be patient** - It learns over time with use

## Example Training Session

```
AI: "Let's start with phrase 1 of 20: 'Add new line'"
You: [Say it with your accent]
AI: "✅ Got it! You said 'Add new lion' for 'Add new line'."

AI: "Phrase 2 of 20: 'Column'"
You: [Say it naturally]
AI: "✅ Got it!..."

[... continues through all phrases ...]

AI: "✅ Training complete! I've learned 20 speech patterns."
```

## Benefits

✅ **Better accuracy** - Understands your accent
✅ **Natural speech** - No need to speak unnaturally
✅ **Faster workflow** - Less corrections needed
✅ **Personalized** - Learns your specific patterns
✅ **Persistent** - Remembers across sessions

This feature makes the AI truly personalized to your voice and accent!

