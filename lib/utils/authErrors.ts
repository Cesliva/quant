/**
 * Converts Firebase authentication error codes to user-friendly error messages
 * This provides a professional, enterprise-grade experience without exposing
 * internal Firebase error details to end users.
 */

export interface FirebaseError {
  code?: string;
  message?: string;
}

/**
 * Maps Firebase error codes to user-friendly messages
 */
export function getAuthErrorMessage(error: FirebaseError | Error | unknown): string {
  // Extract error code from various error formats
  let errorCode: string | undefined;
  let errorMessage: string | undefined;

  if (error && typeof error === 'object') {
    // Firebase error with code property
    if ('code' in error) {
      errorCode = (error as FirebaseError).code;
      errorMessage = (error as FirebaseError).message;
    }
    // Standard Error object
    else if (error instanceof Error) {
      errorMessage = error.message;
      // Try to extract code from message (e.g., "Firebase: Error (auth/email-already-in-use)")
      const codeMatch = errorMessage.match(/auth\/([a-z-]+)/i);
      if (codeMatch) {
        errorCode = `auth/${codeMatch[1]}`;
      }
    }
  }

  // Map Firebase error codes to user-friendly messages
  if (errorCode) {
    switch (errorCode) {
      case 'auth/email-already-in-use':
        return 'This email address is already registered. Please sign in or use a different email address.';
      
      case 'auth/invalid-email':
        return 'Please enter a valid email address.';
      
      case 'auth/operation-not-allowed':
        return 'This sign-in method is not enabled. Please contact support for assistance.';
      
      case 'auth/weak-password':
        return 'Password is too weak. Please choose a stronger password with at least 6 characters.';
      
      case 'auth/user-disabled':
        return 'This account has been disabled. Please contact support for assistance.';
      
      case 'auth/user-not-found':
        return 'No account found with this email address. Please check your email or sign up.';
      
      case 'auth/wrong-password':
        return 'Incorrect password. Please try again or reset your password.';
      
      case 'auth/invalid-credential':
      case 'auth/invalid-verification-code':
        return 'Invalid credentials. Please check your email and password and try again.';
      
      case 'auth/invalid-verification-id':
        return 'Verification code has expired. Please request a new code.';
      
      case 'auth/too-many-requests':
        return 'Too many failed attempts. Please try again later or reset your password.';
      
      case 'auth/network-request-failed':
        return 'Network error. Please check your internet connection and try again.';
      
      case 'auth/popup-closed-by-user':
        return 'Sign-in was cancelled. Please try again.';
      
      case 'auth/cancelled-popup-request':
        return 'Sign-in was cancelled. Please try again.';
      
      case 'auth/account-exists-with-different-credential':
        return 'An account already exists with this email using a different sign-in method. Please use the original sign-in method.';
      
      case 'auth/requires-recent-login':
        return 'For security reasons, please sign in again to complete this action.';
      
      default:
        // If we have a code but don't recognize it, provide a generic message
        if (errorCode.startsWith('auth/')) {
          return 'An authentication error occurred. Please try again or contact support if the problem persists.';
        }
    }
  }

  // If we have an error message but no recognized code, try to extract useful info
  if (errorMessage) {
    // Check if it's a Firebase error format we can parse
    if (errorMessage.includes('Firebase:') || errorMessage.includes('auth/')) {
      return 'An authentication error occurred. Please try again or contact support if the problem persists.';
    }
    
    // For other errors, return a sanitized version (remove Firebase-specific details)
    if (errorMessage.toLowerCase().includes('firebase')) {
      return 'An error occurred. Please try again or contact support if the problem persists.';
    }
  }

  // Fallback to generic error message
  return 'An unexpected error occurred. Please try again or contact support if the problem persists.';
}

/**
 * Checks if an error is a Firebase authentication error
 */
export function isFirebaseAuthError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  
  if ('code' in error) {
    const code = (error as FirebaseError).code;
    return typeof code === 'string' && code.startsWith('auth/');
  }
  
  if (error instanceof Error) {
    return error.message.includes('auth/') || error.message.includes('Firebase:');
  }
  
  return false;
}





