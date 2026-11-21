import "dotenv/config";

import {
  generateAzureChatCompletion,
  getAzureChatModel,
  getAzureMaxCompletionTokens,
} from "./azure-chat";

const answer = await generateAzureChatCompletion([
  {
    role: "system",
    content: "You are a concise test assistant.",
  },
  {
    role: "user",
    content: "Reply with exactly: Azure chat works.",
  },
]);

console.log({
  model: getAzureChatModel(),
  maxCompletionTokens: getAzureMaxCompletionTokens(),
  answer,
});
