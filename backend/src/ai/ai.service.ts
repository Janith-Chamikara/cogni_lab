import { Injectable, InternalServerErrorException } from '@nestjs/common';

type ChatMessage = {
  role: 'system' | 'user' | 'assistant';
  content: string;
};

@Injectable()
export class AiService {
  async chat(messages: ChatMessage[]): Promise<string> {
    const apiKey = process.env.OPENROUTER_API_KEY;
    const model =
      process.env.OPENROUTER_MODEL || 'meta-llama/llama-3.1-8b-instruct:free';

    if (!apiKey) {
      throw new InternalServerErrorException('Missing OPENROUTER_API_KEY.');
    }

    const appUrl =
      process.env.OPENROUTER_APP_URL ??
      process.env.FRONTEND_URL ??
      'http://localhost:3000';
    const appName = process.env.OPENROUTER_APP_NAME ?? 'Cogni Lab';

    const response = await fetch(
      'https://openrouter.ai/api/v1/chat/completions',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': appUrl,
          'X-Title': appName,
        },
        body: JSON.stringify({
          model,
          messages,
        }),
      },
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new InternalServerErrorException(`OpenRouter error: ${errorText}`);
    }

    const data = (await response.json()) as {
      choices?: { message?: { content?: string } }[];
    };

    return data.choices?.[0]?.message?.content || 'Sorry, no reply.';
  }
}