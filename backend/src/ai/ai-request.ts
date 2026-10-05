import { BadRequestException } from '@nestjs/common';
import type { StudentCircuitDto } from '../lab/dto/lab.dto';

export type ChatMessage = { role: 'user' | 'assistant'; content: string };
export type AiContext = {
  route?: string;
  pageTitle?: string;
  pageText?: string;
  labId?: string;
  currentStepIndex: number;
  completedStepIds: string[];
  workspace?: StudentCircuitDto;
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
  const context = raw.context === undefined ? {} : record(raw.context);
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
  return { messages, context: parsed };
};
