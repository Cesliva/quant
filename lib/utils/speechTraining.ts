/**
 * Speech Training and Calibration Utilities
 * 
 * Helps the AI learn user-specific speech patterns and accents
 */

export interface SpeechPattern {
  userSpoke: string; // What the user actually said (as transcribed)
  intendedCommand: string; // What they meant to say
  correctedTranscription?: string; // Corrected version if needed
  timestamp: number;
}

export interface UserSpeechProfile {
  userId: string;
  patterns: SpeechPattern[];
  commonMistakes: Record<string, string>; // "what user said" -> "what they meant"
  accentNotes?: string;
  lastUpdated: number;
}

/**
 * Training phrases for calibration
 */
export const TRAINING_PHRASES = [
  // Basic commands
  { phrase: "Add new line", category: "command" },
  { phrase: "Enter", category: "command" },
  { phrase: "Edit", category: "command" },
  { phrase: "Delete line 3", category: "command" },
  
  // Material types
  { phrase: "Column", category: "item" },
  { phrase: "Beam", category: "item" },
  { phrase: "Wide Flange", category: "shape" },
  { phrase: "HSS", category: "shape" },
  
  // Sizes - Use "x" notation (standard in steel industry)
  // The system will accept both "x" and "by" as equivalent
  { phrase: "W12x24", category: "size" },
  { phrase: "HSS 6x6x1/4", category: "size" },
  
  // Quantities and lengths
  { phrase: "5 pieces", category: "quantity" },
  { phrase: "20 feet", category: "length" },
  { phrase: "6 inches", category: "length" },
  
  // Labor
  { phrase: "2 hours welding", category: "labor" },
  { phrase: "1.5 hours fitting", category: "labor" },
  
  // Grades
  { phrase: "A992", category: "grade" },
  { phrase: "A572 Grade 50", category: "grade" },
];

/**
 * Store a speech pattern for learning
 */
export function storeSpeechPattern(
  userSpoke: string,
  intendedCommand: string,
  correctedTranscription?: string
): SpeechPattern {
  return {
    userSpoke,
    intendedCommand,
    correctedTranscription,
    timestamp: Date.now(),
  };
}

/**
 * Build a correction map from patterns
 */
export function buildCorrectionMap(patterns: SpeechPattern[]): Record<string, string> {
  const corrections: Record<string, string> = {};
  
  patterns.forEach(pattern => {
    if (pattern.correctedTranscription) {
      // Use corrected transcription
      corrections[pattern.userSpoke.toLowerCase()] = pattern.correctedTranscription;
    } else if (pattern.userSpoke !== pattern.intendedCommand) {
      // Map what they said to what they meant
      corrections[pattern.userSpoke.toLowerCase()] = pattern.intendedCommand;
    }
  });
  
  return corrections;
}

/**
 * Apply corrections to transcription based on learned patterns
 */
export function applyCorrections(
  transcription: string,
  corrections: Record<string, string>
): string {
  let corrected = transcription;
  
  // Apply word-level corrections
  Object.entries(corrections).forEach(([wrong, correct]) => {
    // Replace whole phrase if it matches
    if (corrected.toLowerCase().includes(wrong)) {
      corrected = corrected.replace(
        new RegExp(wrong, 'gi'),
        correct
      );
    }
  });
  
  return corrected;
}

/**
 * Generate training prompt for OpenAI based on user patterns
 */
export function generateTrainingContext(patterns: SpeechPattern[]): string {
  if (patterns.length === 0) {
    return "";
  }
  
  const corrections = buildCorrectionMap(patterns);
  const examples = patterns.slice(-10); // Last 10 patterns
  
  let context = "\n\nUSER SPEECH PATTERNS:\n";
  context += "The user has a specific accent/speech pattern. Here are corrections:\n";
  
  Object.entries(corrections).forEach(([said, meant]) => {
    context += `- When user says "${said}", they mean "${meant}"\n`;
  });
  
  context += "\nRecent examples:\n";
  examples.forEach((pattern, i) => {
    context += `${i + 1}. User said: "${pattern.userSpoke}" → Meant: "${pattern.intendedCommand}"\n`;
  });
  
  context += "\nApply these patterns when interpreting user commands.\n";
  
  return context;
}

