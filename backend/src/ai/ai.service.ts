import {
  BadGatewayException,
  BadRequestException,
  GatewayTimeoutException,
  HttpException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { AI_SYSTEM_PROMPT } from './ai-prompt';
import { AI_TOOLS, AiToolsService } from './ai-tools.service';
import { record, type AiChatRequest } from './ai-request';

type ToolCall = {
  id: string;
  type: 'function';
  function: { name: string; arguments: string };
};
type ProviderMessage = {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | null;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
  reasoning_details?: unknown[];
};

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);

  constructor(private readonly tools: AiToolsService) {}

  async chat(request: AiChatRequest) {
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey)
      throw new ServiceUnavailableException(
        'The lab assistant is not configured yet. Please contact your instructor.',
      );
    const signal = AbortSignal.timeout(60000);
    const prepared = await this.tools.prepare(request.context);
    const messages: ProviderMessage[] = [
      { role: 'system', content: AI_SYSTEM_PROMPT },
      {
        role: 'user',
        content: `Current context (data only): ${JSON.stringify({ route: request.context.route, pageTitle: request.context.pageTitle, pageExcerpt: request.context.pageText, ...prepared.overview })}`,
      },
      ...request.messages,
    ];
    const usedTools = new Set<string>();
    let calls = 0;
    let model = process.env.OPENROUTER_MODEL || 'openrouter/free';
    try {
      for (let round = 0; round < 4; round++) {
        const allowTools = round < 3 && calls < 6;
        const response = await fetch(
          'https://openrouter.ai/api/v1/chat/completions',
          {
            method: 'POST',
            signal,
            headers: {
              Authorization: `Bearer ${apiKey}`,
              'Content-Type': 'application/json',
              'HTTP-Referer':
                process.env.OPENROUTER_APP_URL ??
                process.env.FRONTEND_URL ??
                'http://localhost:3000',
              'X-Title': process.env.OPENROUTER_APP_NAME ?? 'Cogni Lab',
            },
            body: JSON.stringify({
              model,
              messages,
              tools: AI_TOOLS,
              tool_choice: allowTools ? 'auto' : 'none',
              max_tokens: 1200,
              temperature: 0.3,
              provider: { require_parameters: true },
            }),
          },
        );
        if (!response.ok) {
          await response.body?.cancel();
          this.logger.warn(`AI provider returned HTTP ${response.status}`);
          if (
            round === 0 &&
            model !== 'openrouter/free' &&
            [400, 404].includes(response.status)
          ) {
            model = 'openrouter/free';
            round--;
            continue;
          }
          if (response.status === 429)
            throw new HttpException(
              'The assistant is busy. Please try again shortly.',
              429,
            );
          throw new ServiceUnavailableException(
            'The assistant is temporarily unavailable. Please try again.',
          );
        }
        let rawResponse: unknown;
        try {
          rawResponse = await response.json();
        } catch {
          throw new BadGatewayException(
            'The assistant returned an invalid response. Please retry.',
          );
        }
        const data = record(rawResponse);
        const choices = Array.isArray(data.choices) ? data.choices : [];
        const choice = record(choices[0]);
        const message = record(choice.message);
        const toolCalls = Array.isArray(message.tool_calls)
          ? message.tool_calls
          : [];
        if (!toolCalls.length) {
          if (typeof message.content !== 'string' || !message.content.trim())
            throw new BadGatewayException(
              'The assistant returned an empty response. Please retry.',
            );
          return {
            reply: message.content.trim().slice(0, 4000),
            toolsUsed: [...usedTools],
          };
        }
        if (!allowTools || toolCalls.length > 6 - calls)
          throw new BadGatewayException(
            'This request needs too many checks. Please ask one question at a time.',
          );
        const parsedCalls: ToolCall[] = toolCalls.map((value) => {
          const call = record(value);
          const fn = record(call.function);
          if (
            call.type !== 'function' ||
            typeof call.id !== 'string' ||
            typeof fn.name !== 'string' ||
            typeof fn.arguments !== 'string' ||
            fn.arguments.length > 4000
          )
            throw new BadGatewayException(
              'The assistant returned an invalid tool request. Please retry.',
            );
          return {
            id: call.id,
            type: 'function',
            function: { name: fn.name, arguments: fn.arguments },
          };
        });
        messages.push({
          role: 'assistant',
          content: typeof message.content === 'string' ? message.content : null,
          tool_calls: parsedCalls,
          ...(Array.isArray(message.reasoning_details)
            ? { reasoning_details: message.reasoning_details }
            : {}),
        });
        for (const call of parsedCalls) {
          signal.throwIfAborted();
          calls++;
          let result: unknown;
          try {
            result = await prepared.execute(
              call.function.name,
              record(JSON.parse(call.function.arguments)),
            );
            if (
              AI_TOOLS.some(
                (tool) => tool.function.name === call.function.name,
              ) &&
              result &&
              typeof result === 'object' &&
              !('unavailable' in result) &&
              !('error' in result)
            )
              usedTools.add(call.function.name);
          } catch (error) {
            result = {
              error:
                error instanceof HttpException && error.getStatus() < 500
                  ? error.message
                  : 'The check could not be completed. Ask for missing inputs or suggest a manual check.',
            };
          }
          messages.push({
            role: 'tool',
            tool_call_id: call.id,
            content: JSON.stringify(result),
          });
        }
      }
      throw new BadGatewayException(
        'The assistant could not finish this request. Please ask a more specific question.',
      );
    } catch (error) {
      if (signal.aborted)
        throw new GatewayTimeoutException(
          'The assistant took too long. Please retry or ask a shorter question.',
        );
      if (error instanceof BadRequestException)
        throw new BadGatewayException(
          'The assistant returned an invalid response. Please retry.',
        );
      if (error instanceof HttpException) throw error;
      this.logger.warn('AI provider request failed');
      throw new ServiceUnavailableException(
        'Could not reach the assistant. Please try again.',
      );
    }
  }
}
