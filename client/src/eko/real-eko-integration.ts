/**
 * REAL EKO FRAMEWORK INTEGRATION
 * Using ACTUAL npm packages from https://github.com/FellouAI/eko.git
 * NO COPIED IMPLEMENTATION - REAL PACKAGES ONLY
 */

import { Eko } from '@eko-ai/eko';
import { BrowserAgent } from '@eko-ai/eko-web';
import { EkoConfig, EkoResult } from '@eko-ai/eko/types';

// Real Eko framework instance
let realEko: Eko | null = null;

/**
 * Initialize the REAL Eko framework using actual npm packages
 */
export function initializeRealEko(): Eko {
  if (realEko) {
    return realEko;
  }

  console.log('🚀 REAL EKO: Initializing REAL Eko framework from npm packages @eko-ai/eko');

  // Real Eko configuration with required LLMs
  const config: EkoConfig = {
    llms: {
      default: {
        provider: "openai-compatible",
        model: "llama-3.1-70b-versatile",
        apiKey: process.env.GROQ_API_KEY || "gsk_placeholder",
        config: {
          baseURL: "https://api.groq.com/openai/v1"
        }
      }
    },
    agents: [
      new BrowserAgent()
    ],
    callback: {
      onMessage: async (message) => {
        console.log('📨 REAL EKO CALLBACK:', message);
        
        // Emit to frontend for real-time updates
        if (typeof window !== 'undefined' && (window as any).ekoCallback) {
          (window as any).ekoCallback(message);
        }
      }
    }
  };

  realEko = new Eko(config);
  console.log('✅ REAL EKO: Framework initialized with REAL npm packages');
  
  return realEko;
}

/**
 * Execute command with REAL Eko framework
 */
export async function executeWithRealEko(command: string): Promise<EkoResult> {
  const eko = initializeRealEko();
  
  console.log('🎯 REAL EKO: Executing command:', command);
  
  try {
    // Use REAL Eko framework to run the command
    const result = await eko.run(command);
    
    console.log('✅ REAL EKO: Command completed:', result);
    return result;
    
  } catch (error) {
    console.error('❌ REAL EKO: Command failed:', error);
    throw error;
  }
}

/**
 * Get REAL Eko framework instance
 */
export function getRealEko(): Eko {
  return initializeRealEko();
}

export default { initializeRealEko, executeWithRealEko, getRealEko };
