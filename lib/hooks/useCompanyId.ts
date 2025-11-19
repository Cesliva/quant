/**
 * Hook to get company ID from auth context
 * For now, returns "default" but can be easily updated when auth is implemented
 */

export function useCompanyId(): string {
  // TODO: Replace with actual auth context when authentication is implemented
  // For now, return default company ID
  return "default";
}

