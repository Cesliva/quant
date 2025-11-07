# AI Agent Learning & Feedback Guide

## Current State

### ✅ What It Does (Session-Based Context)

The AI agent **maintains conversation history within a session**:

1. **Conversation Context**: Each message includes previous conversation history
   - The AI remembers what you said earlier in the same session
   - It can reference previous commands and responses
   - Example: "Change that column to 25 feet" (referring to a previous command)

2. **Context Awareness**: 
   - Knows about existing lines in your estimate
   - Understands the current state of your project
   - Can reference line IDs and previous actions

3. **In-Session Learning**:
   - If you correct it, it remembers within that session
   - Can build on previous commands
   - Understands context from earlier messages

### ❌ What It Doesn't Do (No Persistent Learning)

1. **No Persistent Memory**: 
   - Conversation history is lost when you refresh the page
   - Each new session starts fresh
   - No learning between sessions

2. **No Feedback Collection**:
   - No way to rate responses (thumbs up/down)
   - No correction mechanism
   - No way to tell the AI "that was wrong"

3. **No Fine-Tuning**:
   - Uses a static system prompt
   - Doesn't learn from your specific terminology
   - Doesn't adapt to your workflow

4. **No Cross-User Learning**:
   - Each user's experience is independent
   - No shared learning across users

## How It Works Now

```typescript
// Current implementation maintains conversation in memory
const [conversation, setConversation] = useState<ConversationMessage[]>([]);

// Each API call includes conversation history
const response = await processVoiceCommand(
  message,
  existingLines,
  conversation  // ← This provides context
);
```

**Within a session**, the AI can:
- Reference previous commands
- Understand context from earlier messages
- Build on what you've already said

**But when you refresh**, it starts fresh.

## Adding Learning & Feedback

### Option 1: Persistent Conversation History (Easy)

**Store conversations in Firestore:**

```typescript
// Save conversation to Firestore
await createDocument(
  `companies/${companyId}/projects/${projectId}/conversations`,
  {
    messages: conversation,
    timestamp: Timestamp.now(),
    userId: currentUser.uid
  }
);

// Load on page load
useEffect(() => {
  const loadConversation = async () => {
    const saved = await getDocument(conversationPath);
    if (saved) {
      setConversation(saved.messages);
    }
  };
  loadConversation();
}, []);
```

**Benefits:**
- Conversations persist across sessions
- Can reference previous sessions
- Better context for the AI

### Option 2: Feedback System (Medium)

**Add feedback buttons:**

```typescript
// In VoiceAgent component
<button onClick={() => handleFeedback(messageId, 'good')}>
  👍 Good
</button>
<button onClick={() => handleFeedback(messageId, 'bad')}>
  👎 Bad
</button>

// Store feedback in Firestore
await createDocument(
  `companies/${companyId}/feedback`,
  {
    messageId,
    rating: 'good' | 'bad',
    correction: userCorrection, // optional
    timestamp: Timestamp.now()
  }
);
```

**Benefits:**
- Collect user feedback
- Identify common mistakes
- Improve system prompt based on feedback

### Option 3: Correction Learning (Advanced)

**Allow users to correct mistakes:**

```typescript
// When AI makes a mistake, user can correct it
const handleCorrection = async (originalCommand, correctedAction) => {
  // Store correction
  await createDocument('corrections', {
    originalCommand,
    originalAction: aiResponse,
    correctedAction,
    timestamp: Timestamp.now()
  });
  
  // Use corrections to improve future prompts
  // Add to system prompt: "Based on past corrections..."
};
```

**Benefits:**
- Learn from mistakes
- Adapt to user preferences
- Improve accuracy over time

### Option 4: Fine-Tuning (Advanced)

**Fine-tune GPT model on your data:**

1. Collect high-quality examples from your usage
2. Format as training data
3. Fine-tune GPT-4o-mini on your specific use case
4. Deploy fine-tuned model

**Benefits:**
- Model learns your specific terminology
- Better accuracy for your domain
- Customized to your workflow

**Cost:** ~$0.008 per 1K tokens for fine-tuning

## Recommended Approach

### Phase 1: Add Persistent Conversations (Now)
- Store conversations in Firestore
- Load on page load
- Maintain context across sessions

### Phase 2: Add Feedback System (Next)
- Add thumbs up/down buttons
- Collect feedback data
- Analyze common issues

### Phase 3: Add Corrections (Later)
- Allow users to correct mistakes
- Learn from corrections
- Improve system prompt

### Phase 4: Fine-Tuning (Future)
- Collect training data
- Fine-tune model
- Deploy custom model

## Current Limitations

1. **No Cross-Session Memory**: Each session is independent
2. **No Feedback Loop**: Can't learn from mistakes
3. **Static System Prompt**: Doesn't adapt to your usage
4. **No User-Specific Learning**: Same for all users

## What You Can Do Now

**Within a session:**
- ✅ Reference previous commands
- ✅ Build on earlier messages
- ✅ Use context from conversation

**To improve:**
- Add persistent conversation storage
- Add feedback collection
- Add correction mechanism
- Consider fine-tuning for your domain

## Example: Adding Persistent Conversations

```typescript
// Save conversation when it changes
useEffect(() => {
  if (conversation.length > 0) {
    saveConversation(conversation);
  }
}, [conversation]);

// Load on mount
useEffect(() => {
  loadConversation().then(setConversation);
}, []);
```

This would give you:
- ✅ Conversations persist across sessions
- ✅ AI remembers previous sessions
- ✅ Better context and accuracy

## Summary

**Current State:**
- ✅ Session-based context (remembers within session)
- ❌ No persistent learning
- ❌ No feedback mechanism
- ❌ No cross-session memory

**To Add Learning:**
1. Store conversations in Firestore
2. Add feedback buttons
3. Collect corrections
4. Optionally fine-tune model

The AI is already quite capable, but adding these features would make it learn and improve over time!

