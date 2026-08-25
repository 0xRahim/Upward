"use client";

import ReactMarkdown from "react-markdown";

export function Markdown({ children }: { children: string }) {
  return (
    <div className="prose-compact">
      <ReactMarkdown
        components={{
          h1: (p) => <h2 className="mt-6 mb-3 text-2xl font-semibold tracking-tight first:mt-0" {...p} />,
          h2: (p) => <h3 className="mt-6 mb-2 text-xl font-semibold tracking-tight first:mt-0" {...p} />,
          h3: (p) => <h4 className="mt-4 mb-2 text-lg font-semibold first:mt-0" {...p} />,
          p: (p) => <p className="text-muted-foreground my-3 leading-relaxed first:mt-0" {...p} />,
          ul: (p) => <ul className="my-3 list-disc space-y-1 pl-5" {...p} />,
          ol: (p) => <ol className="my-3 list-decimal space-y-1 pl-5" {...p} />,
          a: (p) => <a className="text-primary underline underline-offset-4" target="_blank" rel="noreferrer" {...p} />,
          code: (p) => (
            <code className="bg-muted rounded px-1.5 py-0.5 font-mono text-[0.85em]" {...p} />
          ),
          pre: (p) => (
            <pre className="bg-muted overflow-x-auto rounded-md p-4 font-mono text-sm" {...p} />
          ),
          blockquote: (p) => <blockquote className="border-l-primary/50 my-3 border-l-2 pl-4 italic" {...p} />,
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
