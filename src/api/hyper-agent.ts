import { ChatOpenAI } from '@langchain/openai';



export const createChatModel = () => {
  if (!process.env.NEXT_PUBLIC_HYPERBOLIC_API_KEY) {
    throw new Error('NEXT_PUBLIC_HYPERBOLIC_API_KEY is not set');
  }

  return new ChatOpenAI({
    modelName: "meta-llama/Llama-3.3-70B-Instruct",
    apiKey: process.env.NEXT_PUBLIC_HYPERBOLIC_API_KEY,
    configuration: {
      baseURL: "https://api.hyperbolic.xyz/v1",
      defaultHeaders: {
        "Content-Type": "application/json"
      }
    },
    maxTokens: 2048,
    temperature: 0.7,
    topP: 0.9
  });
};