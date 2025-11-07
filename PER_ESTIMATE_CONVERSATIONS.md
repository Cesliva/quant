# Per-Estimate Conversation Storage

## Why Per-Estimate Conversations Are Sufficient

### ✅ Perfect Fit for Your Use Case

1. **Each Estimate is Independent**
   - Different projects = different context
   - Different materials, specs, requirements
   - Conversation history should be project-specific

2. **AI Already Gets Project Context**
   - Receives `existingLines` for that project
   - Knows about current state of that estimate
   - Understands project-specific data

3. **Conversation History Per Estimate Helps**
   - "Change that column to 25 feet" (referring to earlier command)
   - "Make all the beams the same grade" (context from previous messages)
   - "Update the quantity we just added" (references earlier action)

### What Per-Estimate Conversations Provide

**Within an Estimate:**
- ✅ Remembers earlier commands in that project
- ✅ Can reference previous actions
- ✅ Understands context from earlier messages
- ✅ Builds on what you've already said
- ✅ Persists across sessions (if you close and reopen)

**Example Flow:**
```
User: "Add a column W12x14, 5 pieces, 20 feet"
AI: "Created column line..."

[User closes browser, comes back later]

User: "Change that column to 25 feet"
AI: "Updating the W12x14 column to 25 feet..." ← Remembers!
```

### What It Won't Do (But That's OK)

**Cross-Estimate Learning:**
- Won't remember preferences from other estimates
- Won't learn "I always use A992 grade" across projects
- Each estimate starts fresh (which is fine!)

**Why This is OK:**
- Each estimate is different anyway
- Project-specific context is more valuable
- User preferences can be stored in company settings instead

## Implementation

### Storage Structure

```typescript
// Firestore path
companies/{companyId}/projects/{projectId}/conversations/{conversationId}

// Document structure
{
  messages: ConversationMessage[],
  createdAt: Timestamp,
  updatedAt: Timestamp,
  userId: string
}
```

### Benefits

1. **Project-Specific Context**
   - Each estimate has its own conversation
   - AI understands that project's context
   - References make sense within that project

2. **Persistent Across Sessions**
   - Close browser, come back later
   - Conversation is still there
   - AI remembers what you said

3. **Clean Separation**
   - Estimate A conversations don't mix with Estimate B
   - Each project is independent
   - Easy to manage and query

## When You Might Need More

### Option: User Preferences (Optional)

If you want to learn user preferences across estimates:

```typescript
// Store in company settings
companies/{companyId}/settings/userPreferences

{
  defaultGrade: "A992",
  preferredTerminology: {
    "beam": "girder",
    "column": "post"
  }
}
```

Then include in system prompt:
```
"User prefers A992 grade by default"
"User uses 'girder' instead of 'beam'"
```

### Option: Company-Wide Learning (Optional)

If you want to learn company-specific terminology:

```typescript
// Store corrections/feedback
companies/{companyId}/aiLearning

{
  corrections: [...],
  commonPatterns: [...],
  terminology: {...}
}
```

Then enhance system prompt with company-specific knowledge.

## Recommendation

**Start with Option 1 (Per-Estimate Conversations):**

✅ **Sufficient for 90% of use cases**
- Each estimate is different anyway
- Project-specific context is most valuable
- Simple to implement
- Easy to understand

**Add Later (If Needed):**
- User preferences in company settings
- Company-wide terminology learning
- Feedback system for improvements

## Summary

**Per-estimate conversations are sufficient because:**
1. ✅ Each estimate is independent
2. ✅ Project-specific context is most valuable
3. ✅ AI already gets project context (existing lines)
4. ✅ Conversation history helps within that estimate
5. ✅ Persists across sessions

**You probably don't need:**
- Cross-estimate learning (each is different)
- Global user preferences (can use settings instead)
- Company-wide learning (can add later if needed)

**Start simple, add complexity only if needed!**

