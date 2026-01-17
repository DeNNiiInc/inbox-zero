export const DEFAULT_PROVIDER = "DEFAULT";

export const Provider = {
  OPEN_AI: "openai",
  ANTHROPIC: "anthropic",
  BEDROCK: "bedrock",
  GOOGLE: "google",
  GROQ: "groq",
  OPENROUTER: "openrouter",
  AI_GATEWAY: "aigateway",
  OLLAMA: "ollama",
};

export const providerOptions: { label: string; value: string }[] = [
  { label: "Default", value: DEFAULT_PROVIDER },
  { label: "Anthropic", value: Provider.ANTHROPIC },
  { label: "OpenAI", value: Provider.OPEN_AI },
  { label: "Google", value: Provider.GOOGLE },
  { label: "Groq", value: Provider.GROQ },
  { label: "OpenRouter", value: Provider.OPENROUTER },
  { label: "AI Gateway", value: Provider.AI_GATEWAY },
  { label: "Ollama", value: Provider.OLLAMA },
];

export const PRECONFIGURED_MODELS = [
  // OpenAI
  { label: "GPT-5.2 (Flagship)", value: "gpt-5.2", provider: Provider.OPEN_AI },
  { label: "GPT-5 Mini (Economy)", value: "gpt-5-mini", provider: Provider.OPEN_AI },
  { label: "GPT-5 Nano (Fast)", value: "gpt-5-nano", provider: Provider.OPEN_AI },
  
  // Anthropic
  { label: "Claude Sonnet 4.5", value: "claude-sonnet-4.5", provider: Provider.ANTHROPIC },
  { label: "Claude Haiku 3.5", value: "claude-haiku-3.5", provider: Provider.ANTHROPIC },
  
  // OpenRouter
  { label: "Llama 3.3 70B (via OpenRouter)", value: "meta-llama/llama-3.3-70b-instruct", provider: Provider.OPENROUTER },
  { label: "Gemini 2.0 Flash (via OpenRouter)", value: "google/gemini-2.0-flash-001", provider: Provider.OPENROUTER },
];
