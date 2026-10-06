import { workspaceIssueGuidance, type ScreenContext } from './ai-guidance';
import type { AiChatRequest } from './ai-request';
import { AiService } from './ai.service';
import type { AiToolsService } from './ai-tools.service';

const reason = 'LED1 is reversed: its anode must face the + side of the supply';
const inspection = {
  components: [{ id: 'student-led', label: 'LED1' }],
  validation: {
    mode: 'rules',
    passed: false,
    checks: { polarity: { passed: false } },
    errors: [reason],
    warnings: [],
  },
};
const screen: ScreenContext = {
  targets: [
    {
      id: 'screen-led',
      componentId: 'student-led',
      label: 'LED',
      kind: 'component',
      action: 'show',
    },
  ],
};
const request: AiChatRequest = {
  messages: [{ role: 'user', content: 'Help troubleshoot my circuit' }],
  context: {
    labId: 'lab-1',
    currentStepIndex: 0,
    completedStepIds: [],
    workspace: {
      components: [{ id: 'student-led', equipmentId: 'equipment-led' }],
      connections: [],
    },
    screen,
  },
};

describe('validated troubleshooting guidance', () => {
  it('links a reversed LED to its actual rendered component id', () => {
    expect(workspaceIssueGuidance(inspection, screen)).toEqual({
      targetId: 'screen-led',
      mode: 'circle',
      purpose: 'issue',
      reason,
    });
  });

  it.each([
    { ...inspection.validation, mode: 'legacy' },
    { ...inspection.validation, passed: true, checks: {}, errors: [] },
    { ...inspection.validation, checks: { steps: { passed: false } } },
  ])('does not annotate legacy, passing or step-only results', (validation) => {
    expect(
      workspaceIssueGuidance({ ...inspection, validation }, screen),
    ).toBeUndefined();
  });

  it('does not guess a target for a general topology error', () => {
    expect(
      workspaceIssueGuidance(
        {
          ...inspection,
          validation: { ...inspection.validation, errors: ['Wrong topology'] },
        },
        screen,
      ),
    ).toBeUndefined();
  });

  it('does not confuse LED1 with LED10', () => {
    expect(
      workspaceIssueGuidance(
        { ...inspection, components: [{ id: 'student-led', label: 'LED10' }] },
        screen,
      ),
    ).toBeUndefined();
  });

  it('does not guess between duplicate component labels', () => {
    expect(
      workspaceIssueGuidance(
        {
          ...inspection,
          components: [
            ...inspection.components,
            { id: 'other-led', label: 'LED1' },
          ],
        },
        screen,
      ),
    ).toBeUndefined();
  });

  it('does not point at a missing component or a similarly named control', () => {
    expect(workspaceIssueGuidance(inspection, undefined)).toBeUndefined();
    expect(
      workspaceIssueGuidance(inspection, {
        targets: [{ ...screen.targets[0], componentId: 'other-led' }],
      }),
    ).toBeUndefined();
    expect(
      workspaceIssueGuidance(inspection, {
        targets: [{ ...screen.targets[0], kind: 'control' }],
      }),
    ).toBeUndefined();
  });
});

describe('AiService troubleshooting without a model guidance call', () => {
  const originalFetch = global.fetch;
  const originalKey = process.env.OPENROUTER_API_KEY;
  const textResponse = {
    ok: true,
    json: () =>
      Promise.resolve({
        choices: [{ message: { content: 'The LED is connected backwards.' } }],
      }),
  };
  const makeService = () => {
    const execute = jest.fn().mockResolvedValue(inspection);
    const tools = {
      prepare: jest.fn().mockResolvedValue({ overview: {}, execute }),
    };
    return {
      service: new AiService(tools as unknown as AiToolsService),
      execute,
    };
  };

  beforeEach(() => {
    process.env.OPENROUTER_API_KEY = 'test-key';
    global.fetch = jest.fn().mockResolvedValue(textResponse);
  });
  afterEach(() => {
    global.fetch = originalFetch;
    if (originalKey === undefined) delete process.env.OPENROUTER_API_KEY;
    else process.env.OPENROUTER_API_KEY = originalKey;
  });

  it('returns a validated circle and short explanation when the model replies only in text', async () => {
    const { service, execute } = makeService();
    const result = await service.chat(request);
    expect(execute).toHaveBeenCalledWith('inspect_workspace', {});
    expect(result.guidance).toEqual(workspaceIssueGuidance(inspection, screen));
    expect(result.reply).toContain(reason);
    expect(result.toolsUsed).toContain('guide_ui');
    expect(result.toolsUsed).toContain('inspect_workspace');
  });

  it('does not add circuit annotations to ordinary learning questions', async () => {
    const { service, execute } = makeService();
    const result = await service.chat({
      ...request,
      messages: [{ role: 'user', content: 'Explain what an LED does' }],
    });
    expect(execute).not.toHaveBeenCalled();
    expect(result.guidance).toBeUndefined();
  });

  it.each(['point', 'circle'])(
    'keeps the model-selected %s without replacing its mode',
    async (mode) => {
      const plan = {
        targetId: 'screen-led',
        mode,
        purpose: 'issue',
        reason,
      };
      global.fetch = jest
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              choices: [
                {
                  message: {
                    tool_calls: [
                      {
                        id: 'inspect',
                        type: 'function',
                        function: {
                          name: 'inspect_workspace',
                          arguments: '{}',
                        },
                      },
                      {
                        id: 'guide',
                        type: 'function',
                        function: {
                          name: 'guide_ui',
                          arguments: JSON.stringify(plan),
                        },
                      },
                    ],
                  },
                },
              ],
            }),
        })
        .mockResolvedValueOnce(textResponse);
      const { service, execute } = makeService();
      const result = await service.chat(request);
      expect(result.guidance).toEqual(plan);
      expect(execute).toHaveBeenCalledTimes(1);
    },
  );
});
