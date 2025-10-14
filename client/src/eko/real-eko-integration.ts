/**
 * REAL EKO FRAMEWORK INTEGRATION
 * Following official Eko patterns from https://github.com/FellouAI/eko.git
 * Secure configuration with backend proxy for API keys
 * VNC-enabled browser automation support
 */

import { Eko } from '@eko-ai/eko';
import { BrowserAgent, FileAgent } from '@eko-ai/eko-web';
import type { LLMs, Agent } from '@eko-ai/eko/types';

// Real Eko framework instance
let realEko: Eko | null = null;
let isInitialized = false;

/**
 * Initialize Eko framework with secure configuration and VNC support
 * Uses backend proxy for API keys to avoid exposing credentials in frontend
 */
export async function initializeRealEko(): Promise<void> {
  if (isInitialized && realEko) {
    console.log('✅ REAL EKO: Already initialized');
    return;
  }

  try {
    console.log('🚀 REAL EKO: Initializing framework with VNC support...');
    
    // Secure LLM configuration using backend proxy
    const llms: LLMs = {
      default: {
        provider: "openai",
        model: "gpt-4o",
        config: {
          baseURL: "/api/llm/proxy", // Backend proxy endpoint
          headers: {
            "X-Client-Request": "true"
          }
        }
      },
      groq: {
        provider: "openai", 
        model: "llama-3.1-70b-versatile",
        config: {
          baseURL: "/api/llm/groq-proxy", // Groq backend proxy
          headers: {
            "X-Client-Request": "true"
          }
        }
      }
    };

    // Initialize VNC-enabled BrowserAgent with proper display configuration
    const vncBrowserAgent = new BrowserAgent({
      // Configure browser to connect to VNC-enabled instances
      browserConfig: {
        headless: false, // Required for VNC visibility
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
          '--disable-software-rasterizer'
        ]
      },
      // VNC integration settings
      vncConfig: {
        enabled: true,
        displayEnv: process.env.DISPLAY || ':99', // Default VNC display
        streamingEnabled: true,
        realTimeUpdates: true
      }
    });

    // Initialize agents following Eko patterns with VNC support
    const agents: Agent[] = [
      vncBrowserAgent,
      new FileAgent()
    ];

    // Create Eko instance with secure configuration and VNC support
    realEko = new Eko({ llms, agents });
    isInitialized = true;
    
    console.log('✅ REAL EKO: Framework initialized successfully with VNC support');
    console.log('🔴 VNC STREAMING: Browser automation will be visible in real-time');
  } catch (error) {
    console.error('❌ REAL EKO: Initialization failed:', error);
    throw new Error(`Eko initialization failed: ${error}`);
  }
}

/**
 * Execute command using Eko framework
 * Follows official Eko patterns for workflow execution
 */
export async function executeWithRealEko(command: string): Promise<{ success: boolean; result: string; error?: string }> {
  try {
    if (!realEko || !isInitialized) {
      await initializeRealEko();
    }

    if (!realEko) {
      throw new Error('Eko framework not initialized');
    }

    console.log('🌐 REAL EKO: Executing command:', command);
    
    // Execute using Eko's run method (official pattern)
    const result = await realEko.run(command);
    
    console.log('✅ REAL EKO: Command executed successfully:', result);
    
    return {
      success: true,
      result: typeof result === 'string' ? result : JSON.stringify(result)
    };
  } catch (error) {
    console.error('❌ REAL EKO: Command execution failed:', error);
    return {
      success: false,
      result: '',
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

/**
 * Check if Eko is initialized
 */
export function isEkoInitialized(): boolean {
  return isInitialized && realEko !== null;
}

/**
 * Get REAL Eko framework instance
 */
export function getRealEko(): Eko {
  return initializeRealEko();
}

export default { initializeRealEko, executeWithRealEko, getRealEko };
