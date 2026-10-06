import { ServiceUnavailableException } from '@nestjs/common';
import { AiService } from './ai.service';
import type { AiToolsService } from './ai-tools.service';
import { parseProgressFeedbackRequest } from './ai-request';

const validation = {
  mode: 'rules',
  passed: false,
  score: 72,
  checks: { matchesReference: { passed: false, label: 'Matches' } },
  errors: ['R2 and R3 should be in parallel, but they are in series'],
  warnings: [],
  summary: { topology: 'series' },
};

const tools = {
  prepare: jest.fn().mockResolvedValue({
    overview: { lab: { name: 'Demo' } },
    execute: jest.fn().mockResolvedValue({
      components: [{ id: 's1', label: 'R2' }],
      connections: [{}, {}],
      validation,
      limitations: 'Unsaved progress check.',
    }),
  }),
} as unknown as AiToolsService;

const context = parseProgressFeedbackRequest({
  context: {
    labId: 'lab-1',
    workspace: {
      components: [{ id: 's1', equipmentId: 'eq-1', labEquipmentId: 'p1' }],
      connections: [],
    },
  },
});

describe('AiService.progressFeedback', () => {
  const originalFetch = global.fetch;
  const originalKey = process.env.OPENROUTER_API_KEY;

  afterEach(() => {
    global.fetch = originalFetch;
    process.env.OPENROUTER_API_KEY = originalKey;
  });

  it('explains the server-side validation result', async () => {
    process.env.OPENROUTER_API_KEY = 'test-key';
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          choices: [
            { message: { content: ' R2 and R3 need to share nodes. ' } },
          ],
        }),
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const result = await new AiService(tools).progressFeedback(context);

    expect(result).toEqual({
      reply: 'R2 and R3 need to share nodes.',
      score: 72,
      passed: false,
    });
    const body = JSON.parse(
      (fetchMock.mock.calls[0] as [string, { body: string }])[1].body,
    ) as { messages: Array<{ content: string }>; tools?: unknown };
    expect(body.tools).toBeUndefined();
    expect(body.messages[1].content).toContain(
      'R2 and R3 should be in parallel',
    );
  });

  it('reports when AI is not configured', async () => {
    delete process.env.OPENROUTER_API_KEY;
    await expect(
      new AiService(tools).progressFeedback(context),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('requires a workspace', () => {
    expect(() =>
      parseProgressFeedbackRequest({ context: { labId: 'lab-1' } }),
    ).toThrow();
  });
});
