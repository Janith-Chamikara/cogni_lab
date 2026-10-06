import { BadRequestException } from '@nestjs/common';
import type { StudentCircuitDto } from '../lab/dto/lab.dto';
import {
  isGuidanceRoute,
  type ScreenContext,
  type ScreenTarget,
} from './ai-guidance';

export type ChatMessage = { role: 'user' | 'assistant'; content: string };
export type AiContext = {
  route?: string;
  pageTitle?: string;
  pageText?: string;
  labId?: string;
  currentStepIndex: number;
  completedStepIds: string[];
  workspace?: StudentCircuitDto;
  screen?: ScreenContext;
};
export type AiChatRequest = { messages: ChatMessage[]; context: AiContext };

export const record = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new BadRequestException('Expected an object.');
  return value as Record<string, unknown>;
};
const text = (value: unknown, limit: number, required = false) => {
  if (value === undefined && !required) return undefined;
  if (typeof value !== 'string' || value.length > limit || !value.trim())
    throw new BadRequestException(
      `Text must contain 1 to ${limit} characters.`,
    );
  return value.trim();
};
const list = (value: unknown, limit: number): unknown[] => {
  if (!Array.isArray(value) || value.length > limit)
    throw new BadRequestException(
      `Expected an array with at most ${limit} items.`,
    );
  return value;
};

export const parseChatRequest = (body: unknown): AiChatRequest => {
  const raw = record(body);
  const messages = list(raw.messages, 24).map((value): ChatMessage => {
    const message = record(value);
    if (message.role !== 'user' && message.role !== 'assistant')
      throw new BadRequestException(
        'Only user and assistant messages are accepted.',
      );
    return { role: message.role, content: text(message.content, 4000, true)! };
  });
  if (
    messages.at(-1)?.role !== 'user' ||
    messages.reduce((size, message) => size + message.content.length, 0) > 24000
  )
    throw new BadRequestException(
      'End with a user message and limit history to 24000 characters.',
    );
  return { messages, context: parseContext(raw.context) };
};

/** Validate page context (lab, live workspace, screen targets). */
export const parseContext = (value: unknown): AiContext => {
  const context = value === undefined ? {} : record(value);
  const currentStepIndex = context.currentStepIndex ?? 0;
  if (
    !Number.isInteger(currentStepIndex) ||
    (currentStepIndex as number) < 0 ||
    (currentStepIndex as number) > 1000
  )
    throw new BadRequestException('Invalid current step.');
  const completedStepIds = list(context.completedStepIds ?? [], 100).map(
    (id) => text(id, 128, true)!,
  );
  const parsed: AiContext = {
    route: text(context.route, 300),
    pageTitle: text(context.pageTitle, 200),
    pageText: text(context.pageText, 1800),
    labId: text(context.labId, 128),
    currentStepIndex: currentStepIndex as number,
    completedStepIds: [...new Set(completedStepIds)],
  };
  if (context.screen !== undefined) {
    const screen = record(context.screen);
    if (JSON.stringify(screen).length > 10000)
      throw new BadRequestException('Screen inventory is too large.');
    const targets = list(screen.targets, 60).map((value): ScreenTarget => {
      const item = record(value);
      if (
        !['control', 'component', 'wire', 'terminal', 'section'].includes(
          String(item.kind),
        ) ||
        !['show', 'navigate', 'help', 'tab'].includes(String(item.action)) ||
        (item.kind !== 'control' && item.action !== 'show')
      )
        throw new BadRequestException('Invalid screen target.');
      const href = text(item.href, 250);
      if (item.action === 'navigate' && (!href || !isGuidanceRoute(href)))
        throw new BadRequestException(
          'Only lab and learning navigation is supported.',
        );
      return {
        id: text(item.id, 20, true)!,
        label: text(item.label, 100, true)!,
        kind: item.kind as ScreenTarget['kind'],
        action: item.action as ScreenTarget['action'],
        href,
        componentId: text(item.componentId, 128),
      };
    });
    if (new Set(targets.map((target) => target.id)).size !== targets.length)
      throw new BadRequestException('Screen target ids must be unique.');
    parsed.screen = { targets };
  }
  if (context.workspace !== undefined) {
    if (!parsed.labId)
      throw new BadRequestException('A workspace needs a lab id.');
    const workspace = record(context.workspace);
    const components = list(workspace.components, 100).map((value) => {
      const item = record(value);
      return {
        id: text(item.id, 128, true)!,
        equipmentId: text(item.equipmentId, 128, true)!,
        labEquipmentId: text(item.labEquipmentId, 128),
      };
    });
    const ids = new Set(components.map((item) => item.id));
    if (ids.size !== components.length)
      throw new BadRequestException('Component ids must be unique.');
    const connections = list(workspace.connections, 200).map((value) => {
      const item = record(value);
      const sourceEquipmentId = text(item.sourceEquipmentId, 128, true)!;
      const targetEquipmentId = text(item.targetEquipmentId, 128, true)!;
      if (!ids.has(sourceEquipmentId) || !ids.has(targetEquipmentId))
        throw new BadRequestException(
          'Connections must refer to placed components.',
        );
      return {
        sourceEquipmentId,
        targetEquipmentId,
        sourceHandle: text(item.sourceHandle ?? undefined, 80),
        targetHandle: text(item.targetHandle ?? undefined, 80),
      };
    });
    parsed.workspace = {
      components,
      connections,
      completedStepIds: parsed.completedStepIds,
    };
  }
  return parsed;
};

/** Body of POST /ai/progress-feedback: the same context as chat. */
export const parseProgressFeedbackRequest = (body: unknown): AiContext => {
  const context = parseContext(record(body).context);
  if (!context.labId || !context.workspace)
    throw new BadRequestException('A lab id and workspace are required.');
  return context;
};
