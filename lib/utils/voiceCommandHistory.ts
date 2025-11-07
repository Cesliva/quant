/**
 * Voice Command History Manager
 * Tracks voice commands for undo/redo functionality
 */

import { EstimatingLine } from "@/components/estimating/EstimatingGrid";

export type VoiceActionType = "create" | "update" | "delete";

export interface VoiceAction {
  type: VoiceActionType;
  timestamp: number;
  // For create: store the created document ID
  // For update: store the document ID and previous state
  // For delete: store the deleted document
  documentId?: string;
  lineId?: string;
  previousState?: Partial<EstimatingLine>; // For update/delete
  newState?: Partial<EstimatingLine>; // For create/update
}

class VoiceCommandHistory {
  private history: VoiceAction[] = [];
  private currentIndex: number = -1;
  private maxHistory: number = 50;

  /**
   * Add an action to history
   */
  addAction(action: VoiceAction): void {
    // Remove any actions after current index (when undoing then doing new action)
    this.history = this.history.slice(0, this.currentIndex + 1);
    
    // Add new action
    this.history.push(action);
    
    // Limit history size
    if (this.history.length > this.maxHistory) {
      this.history.shift();
    } else {
      this.currentIndex++;
    }
  }

  /**
   * Get the last action for undo
   */
  getLastAction(): VoiceAction | null {
    if (this.currentIndex < 0 || this.currentIndex >= this.history.length) {
      return null;
    }
    return this.history[this.currentIndex];
  }

  /**
   * Move back in history (undo)
   * Returns the action to undo
   */
  undo(): VoiceAction | null {
    if (this.currentIndex < 0) {
      return null;
    }
    const action = this.history[this.currentIndex];
    this.currentIndex--;
    return action;
  }

  /**
   * Move forward in history (redo)
   * Returns the action to redo
   */
  redo(): VoiceAction | null {
    if (this.currentIndex >= this.history.length - 1) {
      return null;
    }
    this.currentIndex++;
    return this.history[this.currentIndex];
  }

  /**
   * Check if undo is possible
   */
  canUndo(): boolean {
    return this.currentIndex >= 0;
  }

  /**
   * Check if redo is possible
   */
  canRedo(): boolean {
    return this.currentIndex < this.history.length - 1;
  }

  /**
   * Clear history
   */
  clear(): void {
    this.history = [];
    this.currentIndex = -1;
  }

  /**
   * Get history for debugging
   */
  getHistory(): VoiceAction[] {
    return this.history.slice(0, this.currentIndex + 1);
  }
}

// Singleton instance
export const voiceCommandHistory = new VoiceCommandHistory();

