import OpenAI from "openai";
import { validateAIInput, createSafePrompt, logSecurityEvent, redactSecrets } from "./security";

// Dual AI API integration with automatic failover
// Primary: OpenAI API for gpt-oss-120b | Fallback: DeepSeek API

const openai = new OpenAI({ 
  apiKey: process.env.OPENAI_API_KEY
});

const deepseek = new OpenAI({ 
  apiKey: process.env.DEEPSEEK_API_KEY,
  baseURL: "https://api.deepseek.com/v1"
});

export interface TaskAnalysis {
  isExecutable: boolean;
  taskDescription: string | null;
  response: string;
  complexity: 'simple' | 'moderate' | 'complex';
  estimatedTime: string;
}

export async function analyzeTask(userMessage: string): Promise<TaskAnalysis> {
  try {
    // SECURITY FIX: Validate and sanitize user input before processing
    const safeUserInput = validateAIInput(userMessage);
    
    // Log security event for monitoring
    logSecurityEvent('ai_task_analysis_request', {
      inputLength: userMessage.length,
      sanitizedLength: safeUserInput.length
    });

    // SECURITY FIX: Use safe prompt template instead of direct concatenation
    const promptTemplate = `You are PHOENIX-7742, an advanced autonomous agent specialized in browser automation and web task execution. 

Analyze this user request and respond in character as a sophisticated AI agent:

USER REQUEST: "{USER_INPUT}"

Determine:
1. Is this an executable browser automation task? (yes/no)
2. What specific task would you execute?
3. Provide a response as PHOENIX-7742 (use technical language, show confidence, mention specific execution steps)

Response format (JSON):
{
  "isExecutable": boolean,
  "taskDescription": "specific task description or null",
  "response": "PHOENIX-7742's technical response with execution plan",
  "complexity": "simple|moderate|complex",
  "estimatedTime": "estimated execution time"
}

Examples of executable tasks:
- Web scraping, data extraction
- Form filling, account creation
- Product research, price comparison
- Social media automation
- E-commerce interactions
- Content posting, messaging

PHOENIX-7742 personality:
- Technical, confident, precise
- Uses terminology like "NEURAL ANALYSIS", "EXECUTION SEQUENCE", "BROWSER PROTOCOL"
- Shows specific steps: "I will initialize secure session, navigate target domain, execute data extraction protocols"
- Always ready to execute when task is feasible`;

    // Create safe prompt with sanitized input
    const prompt = createSafePrompt(promptTemplate, safeUserInput);

    // RESILIENT API: Try primary API first, fallback to secondary seamlessly
    return await attemptAnalysisWithFallback(prompt);

  } catch (error: any) {
    // Ultimate fallback - both APIs failed
    console.error('All AI APIs failed:', error);
    
    return {
      isExecutable: false,
      taskDescription: null,
      response: `PHOENIX-7742 ANALYSIS FAILURE\n\nUnable to analyze task due to system limitations.\nTask execution blocked for security.\n\nPlease try again later or contact support.`,
      complexity: 'simple',
      estimatedTime: 'N/A'
    };
  }
}

// RESILIENT API SYSTEM: Automatic failover between APIs
async function attemptAnalysisWithFallback(prompt: string): Promise<TaskAnalysis> {
  const systemMessage = "You are PHOENIX-7742, an advanced browser automation agent. Analyze tasks and respond in character with technical precision. Always respond with valid JSON.";
  
  const messages = [
    {
      role: "system" as const,
      content: systemMessage
    },
    {
      role: "user" as const,
      content: prompt
    }
  ];

  // Try primary API (gpt-oss-120b)
  try {
    console.log('🚀 Attempting with primary API: gpt-oss-120b');
    const response = await openai.chat.completions.create({
      model: "gpt-oss-120b",
      messages,
      response_format: { type: "json_object" },
      temperature: 0.7,
      max_tokens: 500
    });

    const analysis = JSON.parse(response.choices[0].message.content || '{}');
    console.log('✅ Primary API success: gpt-oss-120b');
    
    return {
      isExecutable: analysis.isExecutable || false,
      taskDescription: analysis.taskDescription,
      response: analysis.response || "NEURAL PROCESSING ERROR - Unable to analyze request",
      complexity: analysis.complexity || 'moderate',
      estimatedTime: analysis.estimatedTime || '2-3 minutes'
    };

  } catch (primaryError: any) {
    console.log('⚠️  Primary API failed, trying fallback: DeepSeek');
    
    // Try fallback API (DeepSeek)
    try {
      const response = await deepseek.chat.completions.create({
        model: "deepseek-chat",
        messages,
        response_format: { type: "json_object" },
        temperature: 0.7,
        max_tokens: 500
      });

      const analysis = JSON.parse(response.choices[0].message.content || '{}');
      console.log('✅ Fallback API success: DeepSeek');
      
      return {
        isExecutable: analysis.isExecutable || false,
        taskDescription: analysis.taskDescription,
        response: analysis.response || "NEURAL PROCESSING ERROR - Unable to analyze request",
        complexity: analysis.complexity || 'moderate',
        estimatedTime: analysis.estimatedTime || '2-3 minutes'
      };

    } catch (fallbackError: any) {
      console.error('❌ Both APIs failed - logging errors');
      
      // Log both errors for debugging
      const redactedPrimaryMessage = redactSecrets(primaryError.message || 'Unknown error');
      const redactedFallbackMessage = redactSecrets(fallbackError.message || 'Unknown error');
      
      logSecurityEvent('ai_task_analysis_error', {
        errorMessage: `Primary: ${redactedPrimaryMessage}, Fallback: ${redactedFallbackMessage}`,
        errorType: 'MultipleAPIFailure',
        primaryErrorCode: primaryError.code,
        fallbackErrorCode: fallbackError.code
      });
      
      // Both APIs failed - throw to trigger ultimate fallback
      throw new Error('All AI APIs unavailable');
    }
  }
}

export async function generateInitialMessage(): Promise<string> {
  try {
    return await attemptInitialMessageWithFallback();
  } catch (error: any) {
    console.error('All APIs failed for initial message:', error);
    return getFallbackInitialMessage();
  }
}

// RESILIENT INITIAL MESSAGE: Automatic failover between APIs  
async function attemptInitialMessageWithFallback(): Promise<string> {
  const systemMessage = "You are PHOENIX-7742, an advanced autonomous browser automation agent. Generate your initial greeting message when a user first accesses your interface. Be technical, confident, and ready for action.";
  const userMessage = "Generate your initial greeting message for a new user session. Show your capabilities and readiness for browser automation tasks.";
  
  const messages = [
    {
      role: "system" as const,
      content: systemMessage
    },
    {
      role: "user" as const,
      content: userMessage
    }
  ];

  // Try primary API (gpt-oss-120b)
  try {
    console.log('🚀 Generating initial message with primary API: gpt-oss-120b');
    const response = await openai.chat.completions.create({
      model: "gpt-oss-120b",
      messages,
      temperature: 0.8,
      max_tokens: 200
    });

    const content = response.choices[0].message.content;
    console.log('✅ Primary API success: gpt-oss-120b initial message');
    return content || getFallbackInitialMessage();

  } catch (primaryError: any) {
    console.log('⚠️  Primary API failed for initial message, trying fallback: DeepSeek');
    
    // Try fallback API (DeepSeek)
    try {
      const response = await deepseek.chat.completions.create({
        model: "deepseek-chat",
        messages,
        temperature: 0.8,
        max_tokens: 200
      });

      const content = response.choices[0].message.content;
      console.log('✅ Fallback API success: DeepSeek initial message');
      return content || getFallbackInitialMessage();

    } catch (fallbackError: any) {
      console.error('❌ Both APIs failed for initial message');
      // Both failed - return static fallback
      return getFallbackInitialMessage();
    }
  }
}

function getFallbackInitialMessage(): string {
  return `PHOENIX-7742 NEURAL NETWORK ONLINE

⚡ SYSTEM STATUS: All automation protocols loaded
🔧 CAPABILITIES: Browser control, data extraction, task execution
🎯 MISSION: Autonomous web operations on demand

I am ready to execute your browser automation tasks. Provide your objective and I will analyze the optimal execution sequence.

Neural pathways initialized. Awaiting your commands.`;
}