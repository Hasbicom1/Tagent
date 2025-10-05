// Universal free AI adapter using LocalAI's OpenAI-compatible API
// ESM module (project uses "type": "module")

export default class FreeAIService {
  constructor() {
    const internal = process.env.OLLAMA_INTERNAL_URL || 'http://ollama-ai.railway.internal:11434';
    // Normalize base to include /v1
    this.baseUrl = internal.endsWith('/v1') ? internal : `${internal}/v1`;
    // Default model mapping
    this.modelMap = {
      'gpt-3.5-turbo': 'tinyllama-1.1b-chat-v1.0.Q4_K_M.gguf',
      'gpt-4': 'tinyllama-1.1b-chat-v1.0.Q4_K_M.gguf',
      'deepseek-chat': 'tinyllama-1.1b-chat-v1.0.Q4_K_M.gguf',
      'default': 'tinyllama-1.1b-chat-v1.0.Q4_K_M.gguf'
    };
  }

  async listModels() {
    const resp = await fetch(`${this.baseUrl}/models`);
    if (!resp.ok) throw new Error(`LocalAI models error: ${resp.status}`);
    return resp.json();
  }

  async createChatCompletion(params) {
    const body = {
      model: this.modelMap[params?.model] || this.modelMap.default,
      messages: params?.messages || [],
      temperature: params?.temperature ?? 0.7,
      max_tokens: params?.max_tokens ?? 500,
      stream: params?.stream ?? false
    };
    const resp = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    if (!resp.ok) throw new Error(`LocalAI chat error: ${resp.status}`);
    return resp.json(); // OpenAI-compatible shape
  }

  async generate(prompt, options = {}) {
    const body = {
      model: this.modelMap.default,
      prompt,
      max_tokens: options?.max_tokens ?? 500,
      temperature: options?.temperature ?? 0.7
    };
    const resp = await fetch(`${this.baseUrl}/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    if (!resp.ok) throw new Error(`LocalAI completions error: ${resp.status}`);
    const data = await resp.json();
    return data?.choices?.[0]?.text ?? '';
  }
}


