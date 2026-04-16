/**
 * Provider Registry / Factory
 * Central export point for all AI provider client libraries.
 *
 * Usage:
 *   import { groq, claude } from '@/lib/providers';
 *   import { ProviderError } from '@/lib/providers';
 *   import { sendLLMRequest } from '@/lib/providers/groq';
 *   import { sendLLMRequest } from '@/lib/providers/claude';
 */

// ============================================================================
// GROQ PROVIDER
// ============================================================================

export {
  sendLLMRequest as groqSendLLMRequest,
  sendSTTRequest as groqSendSTTRequest,
  testKey as groqTestKey,
  ProviderError,
} from './groq/index';

export type {
  LLMMessage,
  LLMRequest,
  LLMResponse,
  STTRequest,
  STTResponse,
  KeyTestResult,
} from './groq/index';

// Re-export the Groq module as a namespace for convenience
import * as groq from './groq/index';
export { groq };

// ============================================================================
// CLAUDE PROVIDER
// ============================================================================

export {
  sendLLMRequest as claudeSendLLMRequest,
  testKey as claudeTestKey,
} from './claude/index';

export type {
  LLMMessage as ClaudeLLMMessage,
  LLMRequest as ClaudeLLMRequest,
  LLMResponse as ClaudeLLMResponse,
  KeyTestResult as ClaudeKeyTestResult,
} from './claude/index';

// Re-export the Claude module as a namespace for convenience
import * as claude from './claude/index';
export { claude };

// ============================================================================
// OPENAI PROVIDER
// ============================================================================

import * as openai from './openai/index';
export { openai };

// ============================================================================
// ELEVENLABS PROVIDER
// ============================================================================

import * as elevenlabs from './elevenlabs/index';
export { elevenlabs };

// ============================================================================
// UPLIFT AI PROVIDER
// ============================================================================

import * as upliftAi from './uplift-ai/index';
export { upliftAi };

// ============================================================================
// GOOGLE CLOUD PROVIDER
// ============================================================================

import * as googleCloud from './google-cloud/index';
export { googleCloud };

// ============================================================================
// AMAZON POLLY PROVIDER
// ============================================================================

import * as amazonPolly from './amazon-polly/index';
export { amazonPolly };

// ============================================================================
// PROVIDER REGISTRY
// ============================================================================

/**
 * Supported provider names
 */
export type ProviderName = 'groq' | 'claude' | 'openai' | 'elevenlabs' | 'uplift-ai' | 'google-cloud' | 'amazon-polly';

/**
 * Registry of available provider modules.
 * Additional providers will be added here as they are implemented.
 */
export const providerRegistry = {
  groq,
  claude,
  openai,
  elevenlabs,
  upliftAi,
  googleCloud,
  amazonPolly,
};

/**
 * Get a provider module by name
 */
export function getProvider(name: ProviderName) {
  return (providerRegistry as any)[name];
}

const providers = { groq, claude, openai, elevenlabs, upliftAi, googleCloud, amazonPolly, providerRegistry, getProvider };
export default providers;
