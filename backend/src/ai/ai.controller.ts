import { Body, Controller, Post } from '@nestjs/common';
import { AiService } from './ai.service';
import { parseChatRequest } from './ai-request';

@Controller('ai')
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Post('chat')
  async chat(@Body() body: unknown) {
    return this.aiService.chat(parseChatRequest(body));
  }
}
