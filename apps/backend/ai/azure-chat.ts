interface AzureChatResponse {
  choices?: Array<{
    message?: {
      content?: string | null;
    };
  }>;
}

export interface AzureChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export function getAzureChatModel() {
  const model = process.env.AZURE_OPENAI_CHAT_MODEL;

  if (!model) {
    throw new Error("AZURE_OPENAI_CHAT_MODEL is not defined");
  }

  return model;
}

export function getAzureMaxCompletionTokens() {
  return Number(process.env.AZURE_OPENAI_MAX_COMPLETION_TOKENS ?? 512);
}

export async function generateAzureChatCompletion(
  messages: AzureChatMessage[],
) {
  const apiKey = process.env.AZURE_OPENAI_API_KEY;
  const baseUrl = getAzureOpenAIBaseUrl();
  const model = getAzureChatModel();
  const maxCompletionTokens = getAzureMaxCompletionTokens();

  if (!apiKey) {
    throw new Error("AZURE_OPENAI_API_KEY is not defined");
  }

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "api-key": apiKey,
    },
    body: JSON.stringify({
      model,
      messages,
      max_completion_tokens: maxCompletionTokens,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();

    throw new Error(`Azure chat failed: ${response.status} ${errorText}`);
  }

  const result = (await response.json()) as AzureChatResponse;
  const content = result.choices?.[0]?.message?.content;

  if (!content) {
    throw new Error("Azure chat returned no message content");
  }

  return content;
}

function getAzureOpenAIBaseUrl() {
  const rawBaseUrl = process.env.AZURE_OPENAI_BASE_URL;

  if (!rawBaseUrl) {
    throw new Error("AZURE_OPENAI_BASE_URL is not defined");
  }

  const baseUrl = rawBaseUrl.replace(/\/$/, "");

  if (baseUrl.endsWith("/openai/v1")) {
    return baseUrl;
  }

  return `${baseUrl}/openai/v1`;
}
