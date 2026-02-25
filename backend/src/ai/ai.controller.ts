import { Body, Controller, Post } from '@nestjs/common';
import { AiService } from './ai.service';

type ChatMessage = {
  role: 'system' | 'user' | 'assistant';
  content: string;
};

type AiChatRequest = {
  messages: ChatMessage[];
};

@Controller('ai')
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Post('chat')
  async chat(@Body() body: AiChatRequest) {
    const reply = await this.aiService.chat(body.messages || []);
    return { reply };
  }
}