import { Body, Controller, Post } from '@nestjs/common';
import { AiService } from './ai.service';
import { parseChatRequest, parseProgressFeedbackRequest } from './ai-request';

@Controller('ai')
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Post('chat')
  async chat(@Body() body: unknown) {
    return this.aiService.chat(parseChatRequest(body));
  }

  /** AI explanation of a Check Progress result for the current workspace. */
  @Post('progress-feedback')
  async progressFeedback(@Body() body: unknown) {
    return this.aiService.progressFeedback(parseProgressFeedbackRequest(body));
  }
}
