import { BadRequestException } from '@nestjs/common';

export type ScreenTarget = {
  id: string;
  label: string;
  kind: 'control' | 'component' | 'wire' | 'terminal' | 'section';
  action: 'show' | 'navigate' | 'help' | 'tab';
  href?: string;
  componentId?: string;
};
export type ScreenContext = { targets: ScreenTarget[] };
export type GuidancePlan = {
  targetId: string;
  mode: 'point' | 'circle' | 'arrow' | 'click';
  purpose: 'locate' | 'issue' | 'navigate';
  reason: string;
};

export const isGuidanceRoute = (href: string) =>
  /^(?:\/(?:student\/)?dashboard|\/(?:student\/lab|labs)\/[a-zA-Z0-9_-]+|\/modules|\/lab-equipment)$/.test(
    href,
  );

export const requestsNavigation = (message: string) =>
  /\b(?:open|click|navigate|visit|launch|go to|take me)\b/i.test(message) &&
  !/\b(?:where|how)\b/i.test(message) &&
  !/\b(?:don't|do not|never|without|no need to)\b.{0,40}\b(?:open|click|navigate|visit|launch|go to|take me)\b/i.test(
    message,
  );

type ConversationMessage = { role: 'user' | 'assistant'; content: string };
type NavigationIntent = {
  request: string;
  followUp: boolean;
  selection?: string;
};
export const navigationIntent = (
  messages: ConversationMessage[],
  depth = 0,
): NavigationIntent | undefined => {
  const last = messages.at(-1);
  if (last?.role !== 'user') return undefined;
  if (requestsNavigation(last.content))
    return { request: last.content, followUp: false };
  if (depth >= 3 || messages.at(-2)?.role !== 'assistant') return undefined;
  const confirmation =
    /^(?:(?:yes|yeah|yep|sure|okay|ok)(?:[, ]+(?:that one|this one|please|go ahead|do it))?|that one|this one|go ahead|do it|please do)[.!?]*$/i.test(
      last.content.trim(),
    );
  if (
    !confirmation &&
    (last.content.length > 100 ||
      /\b(?:no|nah|nope|stop|cancel|don't|do not|where|how|why|what|explain|calculate|help|error|wrong|struggling)\b/i.test(
        last.content,
      ))
  )
    return undefined;
  if (
    !confirmation &&
    !/\b(?:open|which|choose|select|name|navigate|would you like)\b/i.test(
      messages.at(-2)!.content,
    )
  )
    return undefined;
  const previous = navigationIntent(messages.slice(0, -2), depth + 1);
  return previous
    ? {
        request: previous.request,
        followUp: true,
        selection: confirmation ? undefined : last.content,
      }
    : undefined;
};

const normalizeLabel = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();

export const authorizesNavigation = (
  messages: ConversationMessage[],
  screen: ScreenContext,
  target: ScreenTarget,
) => {
  const intent = navigationIntent(messages);
  if (!intent) return false;
  if (!intent.followUp) return true;
  const matches = (reference: string) =>
    screen.targets.filter((item) => {
      const label = normalizeLabel(item.label.replace(/^Open\s+/i, ''));
      return (
        item.action !== 'show' &&
        label.length >= 3 &&
        ` ${normalizeLabel(reference)} `.includes(` ${label} `)
      );
    });
  const requested = matches(intent.request);
  const referenced = intent.selection
    ? screen.targets.filter(
        (item) =>
          item.action !== 'show' &&
          normalizeLabel(item.label.replace(/^Open\s+/i, '')) ===
            normalizeLabel(
              intent.selection!.replace(/^the\s+|\s+please$/gi, ''),
            ),
      )
    : requested.length
      ? requested
      : matches(messages.at(-2)!.content);
  const destinations = new Set(
    referenced.map(
      (item) => `${item.action}:${item.href ?? normalizeLabel(item.label)}`,
    ),
  );
  return (
    destinations.size === 1 && referenced.some((item) => item.id === target.id)
  );
};

export const navigationClarification = (screen: ScreenContext) => {
  const options = [
    ...new Set(
      screen.targets
        .filter((target) => target.action !== 'show')
        .sort(
          (a, b) =>
            Number(b.action === 'navigate') - Number(a.action === 'navigate'),
        )
        .map((target) => target.label.replace(/^Open\s+/i, '')),
    ),
  ].slice(0, 4);
  return (
    'I can open a listed lab, but I can’t match that choice to a single option on the current screen.' +
    (options.length
      ? `\n\n### Available here\n\n${options.map((label) => `- **${label}**`).join('\n')}\n\nWhich one would you like me to open?`
      : '\n\nOpen your lab list so I can see the available choices, then tell me the lab name.')
  );
};

export const UI_GUIDANCE_SKILL = `Visual guidance skill:
The screen inventory lists actual rendered targets; rows are [id,label,kind,allowedAction,href?,componentId?]. Use only these ids. Do not infer targets from previous pages.
Use actual listed lab and module names only. Earlier assistant examples are not evidence that a lab exists. For 'what can I do here', describe current visible options. If a previously suggested name is not listed, correct that suggestion and offer actual options; never promise to load an invented lab.
For 'where', 'show me', 'circle' or a student struggling to find something, use guide_ui to point, draw a hand-drawn circle or an arrow. Explain the learning purpose in its short reason. Highlight one relevant target, then let the student act. Do not use the cursor for every ordinary explanation.
Before showing a lab error, use inspect_workspace, identify an actual failed check or warning, then guide_ui with purpose=issue on the corresponding component, terminal or wire. Never label a guess as a verified error. Legacy validation cannot identify incorrect electrical wiring.
You CAN open permitted views with guide_ui; do not say you cannot open labs categorically. Click when the latest student message explicitly requests opening, navigation or a click, or briefly confirms the immediately preceding navigation request ('yeah that one'). A confirmation must resolve to one actual target named in that request or your preceding reply; otherwise ask which listed destination they mean. Only targets marked navigate, help or tab support clicks. Where-is questions require highlighting, not clicking. Ambiguous lab names require clarification. If the target is in an unopened tab, offer to open that tab first and let the student request the next view.
You may open a listed lab, dashboard, read-only tab or instructor help guide. You must NEVER build or repair a circuit, drag equipment, connect/disconnect wires, edit inputs/settings, toggle experiment steps, start/run an experiment, save, grade, submit or delete anything, even if asked. Point to the control and explain what the student can do instead.
Think about the student's intent, available evidence and allowed action before selecting a target; give a short public reason, not internal reasoning. Address the student naturally in that reason ('This opens your instructor's guide'), rather than narrating their request or saying 'the student requested'. The blue cursor is a separate app overlay and never controls the student's real cursor. An action is a proposal until the browser checks and executes it. Do not claim it already happened. Only one guidance target is allowed per answer; no autonomous multi-page sequences.`;

export const UI_GUIDANCE_TOOL = {
  type: 'function',
  function: {
    name: 'guide_ui',
    description:
      'Propose one educational pointer, circle, arrow or explicitly requested safe navigation click on a current screen target. Cannot perform experiment work.',
    parameters: {
      type: 'object',
      properties: {
        targetId: { type: 'string' },
        mode: { type: 'string', enum: ['point', 'circle', 'arrow', 'click'] },
        purpose: { type: 'string', enum: ['locate', 'issue', 'navigate'] },
        reason: { type: 'string', maxLength: 180 },
      },
      required: ['targetId', 'mode', 'purpose', 'reason'],
      additionalProperties: false,
    },
  },
};

export const proposeGuidance = (
  args: Record<string, unknown>,
  screen: ScreenContext | undefined,
  messages: ConversationMessage[],
  hasIssues: boolean,
): GuidancePlan => {
  const target = screen?.targets.find((item) => item.id === args.targetId);
  if (!target)
    throw new BadRequestException(
      'That target is not on the current screen. Ask the student to open the relevant view.',
    );
  if (
    !['point', 'circle', 'arrow', 'click'].includes(String(args.mode)) ||
    !['locate', 'issue', 'navigate'].includes(String(args.purpose))
  )
    throw new BadRequestException('Unsupported guidance action.');
  if (
    typeof args.reason !== 'string' ||
    !args.reason.trim() ||
    args.reason.length > 180
  )
    throw new BadRequestException(
      'Explain the educational purpose in at most 180 characters.',
    );
  if (
    args.purpose === 'issue' &&
    (!hasIssues || !['component', 'terminal', 'wire'].includes(target.kind))
  )
    throw new BadRequestException(
      'Inspect the workspace and find a failed circuit rule check or warning before pointing out an error. Legacy counts and incomplete steps cannot identify a circuit error.',
    );
  if (args.mode === 'click') {
    if (
      args.purpose !== 'navigate' ||
      !authorizesNavigation(messages, screen!, target)
    )
      throw new BadRequestException(
        'The student has not explicitly requested a navigation click. Show the target instead.',
      );
    if (
      target.action === 'navigate' &&
      screen?.targets.some(
        (item) =>
          item.id !== target.id &&
          item.label.toLowerCase() === target.label.toLowerCase() &&
          item.action === 'navigate' &&
          item.href !== target.href,
      )
    )
      throw new BadRequestException(
        'Several destinations have this name. Ask the student which one they mean.',
      );
    if (
      target.action === 'show' ||
      (target.action === 'navigate' &&
        (!target.href || !isGuidanceRoute(target.href)))
    )
      throw new BadRequestException(
        "This target may only be highlighted. Experiment actions remain the student's responsibility.",
      );
  }
  return {
    targetId: target.id,
    mode: args.mode as GuidancePlan['mode'],
    purpose: args.purpose as GuidancePlan['purpose'],
    reason: args.reason.trim(),
  };
};
