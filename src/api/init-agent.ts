
interface ApiRequest {
  method: string;
  body: any;
}

interface ApiResponse {
  status: (code: number) => ApiResponse;
  json: (data: any) => void;
}
import { initializeAgent } from './agent';

export default async function handler(
  req: ApiRequest,
  res: ApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { agent, config: { configurable } } = await initializeAgent();
    res.status(200).json({ agent, config: { thread_id: configurable.thread_id } });
  } catch (error) {
    console.error('Error initializing agent:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
}