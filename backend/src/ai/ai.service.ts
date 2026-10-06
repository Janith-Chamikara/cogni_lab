import {
  BadGatewayException,
  BadRequestException,
  GatewayTimeoutException,
  HttpException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { AI_SYSTEM_PROMPT, PROGRESS_FEEDBACK_PROMPT } from './ai-prompt';
import { AI_TOOLS, AiToolsService } from './ai-tools.service';
import { record, type AiChatRequest, type AiContext } from './ai-request';
import {
  proposeGuidance,
  workspaceIssueGuidance,
  authorizesNavigation,
  navigationClarification,
  navigationIntent,
  UI_GUIDANCE_SKILL,
  UI_GUIDANCE_TOOL,
  type GuidancePlan,
} from './ai-guidance';

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
    const screen = request.context.screen;
    if (
      screen?.targets.length &&
      navigationIntent(request.messages)?.followUp &&
      !screen.targets.some(
        (target) =>
          target.action !== 'show' &&
          authorizesNavigation(request.messages, screen, target),
      )
    )
      return { reply: navigationClarification(screen), toolsUsed: [] };
    const availableTools = screen?.targets.length
      ? [...AI_TOOLS, UI_GUIDANCE_TOOL]
      : AI_TOOLS;
    let guidance: GuidancePlan | undefined;
    let hasWorkspaceIssues = false;
    let workspaceInspection: unknown;
    const messages: ProviderMessage[] = [
      {
        role: 'system',
        content:
          AI_SYSTEM_PROMPT +
          (screen?.targets.length ? '\n' + UI_GUIDANCE_SKILL : ''),
      },
      {
        role: 'user',
        content: `Current context (data only): ${JSON.stringify({ route: request.context.route, pageTitle: request.context.pageTitle, pageExcerpt: request.context.pageText, ...prepared.overview, screen: screen?.targets.map((target) => [target.id, target.label, target.kind, target.action, target.href ?? null, target.componentId ?? null]) })}`,
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
              tools: availableTools,
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
          if (
            !guidance &&
            screen?.targets.some((target) => target.kind === 'component') &&
            request.context.workspace &&
            /\btroubleshoot(?:ing)?\b/i.test(
              request.messages.at(-1)?.content ?? '',
            )
          ) {
            try {
              workspaceInspection ??= await prepared.execute(
                'inspect_workspace',
                {},
              );
              guidance = workspaceIssueGuidance(workspaceInspection, screen);
              if (guidance) {
                usedTools.add('inspect_workspace');
                usedTools.add('guide_ui');
                const target = screen.targets.find(
                  (item) => item.id === guidance!.targetId,
                )!;
                return {
                  reply: `I’ll point out **${target.label}**.\n\n${guidance.reason}`,
                  toolsUsed: [...usedTools],
                  guidance,
                };
              }
            } catch {
              // Keep the chat reply if the read-only check is unavailable.
              this.logger.warn('Could not locate a troubleshooting issue.');
            }
          }
          return {
            reply: message.content.trim().slice(0, 4000),
            toolsUsed: [...usedTools],
            guidance,
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
            const args = record(JSON.parse(call.function.arguments));
            if (call.function.name === 'guide_ui') {
              if (guidance)
                throw new BadRequestException(
                  'Only one guidance target per answer.',
                );
              guidance = proposeGuidance(
                args,
                screen,
                request.messages,
                hasWorkspaceIssues,
              );
              result = { proposed: true, reason: guidance.reason };
            } else {
              result = await prepared.execute(call.function.name, args);
              if (
                call.function.name === 'inspect_workspace' &&
                result &&
                typeof result === 'object' &&
                'validation' in result
              ) {
                const validation = record(result.validation);
                workspaceInspection = result;
                const checks = record(validation.checks);
                hasWorkspaceIssues =
                  validation.mode === 'rules' &&
                  ((Array.isArray(validation.warnings) &&
                    validation.warnings.length > 0) ||
                    Object.entries(checks).some(
                      ([key, value]) =>
                        key !== 'steps' && record(value).passed === false,
                    ));
              }
            }
            if (
              availableTools.some(
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
        if (
          guidance &&
          parsedCalls.every((call) => call.function.name === 'guide_ui')
        ) {
          const target = screen!.targets.find(
            (item) => item.id === guidance!.targetId,
          )!;
          return {
            reply: `${guidance.mode === 'click' ? 'Let’s open' : 'I’ll point out'} **${guidance.mode === 'click' ? target.label.replace(/^Open\s+/i, '') : target.label}**.\n\n${guidance.reason}`,
            toolsUsed: [...usedTools],
            guidance,
          };
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

  /**
   * Tutor-style explanation of a Check Progress result. The circuit is
   * validated again here, so the model only sees server-side evidence (never
   * a result supplied by the browser). One model call, no tools.
   */
  async progressFeedback(context: AiContext) {
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey)
      throw new ServiceUnavailableException(
        'AI feedback is not configured yet.',
      );
    const prepared = await this.tools.prepare(context);
    const inspection = record(await prepared.execute('inspect_workspace', {}));
    const validation = record(inspection.validation);
    const signal = AbortSignal.timeout(30000);
    const messages: ProviderMessage[] = [
      {
        role: 'system',
        content: `${AI_SYSTEM_PROMPT}\n${PROGRESS_FEEDBACK_PROMPT}`,
      },
      {
        role: 'user',
        content: `Check Progress evidence (data only): ${JSON.stringify({
          lab: prepared.overview.lab,
          workspace: {
            components: inspection.components,
            connectionCount: Array.isArray(inspection.connections)
              ? inspection.connections.length
              : 0,
          },
          validation: {
            mode: validation.mode,
            passed: validation.passed,
            score: validation.score,
            checks: validation.checks,
            errors: validation.errors,
            warnings: validation.warnings,
            summary: validation.summary,
          },
          limitations: inspection.limitations,
        })}`,
      },
    ];

    try {
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
            model: process.env.OPENROUTER_MODEL || 'openrouter/free',
            messages,
            max_tokens: 500,
            temperature: 0.3,
          }),
        },
      );
      if (!response.ok) {
        await response.body?.cancel();
        this.logger.warn(
          `AI provider returned HTTP ${response.status} for progress feedback`,
        );
        throw new ServiceUnavailableException(
          response.status === 429
            ? 'The assistant is busy. Please try again shortly.'
            : 'AI feedback is temporarily unavailable.',
        );
      }
      const data = record(await response.json());
      const choices = Array.isArray(data.choices) ? data.choices : [];
      const content = record(record(choices[0]).message).content;
      if (typeof content !== 'string' || !content.trim())
        throw new BadGatewayException(
          'The assistant returned an empty response. Please retry.',
        );
      return {
        reply: content.trim().slice(0, 2000),
        score: validation.score,
        passed: validation.passed,
      };
    } catch (error) {
      if (signal.aborted)
        throw new GatewayTimeoutException('AI feedback took too long.');
      if (error instanceof HttpException) throw error;
      this.logger.warn('AI progress feedback request failed');
      throw new ServiceUnavailableException(
        'Could not reach the assistant. Please try again.',
      );
    }
  }
}
