import type { ReactNode } from "react";
import Markdown from "react-markdown";

const SectionHeading = ({ children }: { children?: ReactNode }) => (
  <h3 className="border-b border-border/60 pb-1.5 text-sm font-semibold text-foreground">
    {children}
  </h3>
);

export function AiMessageContent({ content }: { content: string }) {
  return (
    <div className="min-w-0 space-y-3 break-words text-sm leading-6 [&_li>p]:my-1 [&_li>ul]:mt-1.5 [&_li>ol]:mt-1.5 [&_pre>code]:bg-transparent [&_pre>code]:p-0">
      <Markdown
        skipHtml
        unwrapDisallowed
        allowedElements={[
          "p",
          "strong",
          "em",
          "ul",
          "ol",
          "li",
          "h1",
          "h2",
          "h3",
          "h4",
          "h5",
          "h6",
          "blockquote",
          "code",
          "pre",
          "br",
          "hr",
        ]}
        components={{
          h1: SectionHeading,
          h2: SectionHeading,
          h3: SectionHeading,
          h4: SectionHeading,
          h5: SectionHeading,
          h6: SectionHeading,
          p: ({ children }) => (
            <p className="whitespace-pre-line">{children}</p>
          ),
          strong: ({ children }) => (
            <strong className="font-semibold text-foreground">
              {children}
            </strong>
          ),
          ul: ({ children }) => (
            <ul className="list-disc space-y-1.5 pl-5 marker:text-primary/70">
              {children}
            </ul>
          ),
          ol: ({ children, start }) => (
            <ol
              start={start}
              className="list-decimal space-y-2 pl-5 marker:font-semibold marker:text-primary"
            >
              {children}
            </ol>
          ),
          li: ({ children }) => <li className="pl-1">{children}</li>,
          blockquote: ({ children }) => (
            <blockquote className="space-y-2 border-l-2 border-primary/40 pl-3 text-muted-foreground">
              {children}
            </blockquote>
          ),
          code: ({ children }) => (
            <code className="rounded bg-primary/8 px-1.5 py-0.5 font-mono text-[0.85em] text-foreground [overflow-wrap:anywhere]">
              {children}
            </code>
          ),
          pre: ({ children }) => (
            <pre className="max-w-full overflow-x-auto rounded-lg border border-primary/15 bg-primary/5 px-3 py-2.5 text-xs leading-5">
              {children}
            </pre>
          ),
          hr: () => <hr className="border-border/60" />,
        }}
      >
        {content}
      </Markdown>
    </div>
  );
}
