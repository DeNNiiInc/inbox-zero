import { Provider } from "@/utils/llms/config";
import type { UserAIFields } from "@/utils/llms/types";

/**
 * Optimizes the User AI settings based on the email provider.
 * 
 * Logic (Updated Jan 2026):
 * - Gmail: Use Latest Economy OpenAI Agent (gpt-5.1-chat-latest)
 * - Outlook/Microsoft: Use Latest Premium OpenAI Agent (gpt-5.2)
 * 
 * @param user The user's current AI settings
 * @param provider The email provider (e.g., 'google', 'microsoft', 'office365')
 * @returns Optimized UserAIFields
 */
export function getOptimizedUserAI(
  user: UserAIFields,
  provider: string | undefined | null
): UserAIFields {
  // Clone user object to avoid mutations
  const optimized = { ...user };
  
  if (!provider) return optimized;
  
  const providerLower = provider.toLowerCase();

  // Gmail -> GPT-5 Mini (Balanced power/cost for mid-range replies & classification)
  if (providerLower === "google" || providerLower === "gmail") {
    optimized.aiProvider = Provider.OPEN_AI;
    optimized.aiModel = "gpt-5-mini";
  } 
  // Microsoft/Outlook -> GPT-5.2 (Top tier capability for complex tasks)
  else if (
    providerLower === "microsoft" ||
    providerLower === "outlook" ||
    providerLower === "office365" ||
    providerLower === "exchange"
  ) {
    optimized.aiProvider = Provider.OPEN_AI;
    optimized.aiModel = "gpt-5.2";
  }

  return optimized;
}
