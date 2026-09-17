import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeSanitize from "rehype-sanitize";
import MessageMeta from "@/components/chat/MessageMeta";
import QueueNotice from "@/components/chat/QueueNotice";

// Troca "[2]" (número da fonte que a IA cita no texto) por um link markdown de
// verdade, usando a URL daquela fonte em `citations` (mesma numeração que o
// backend manda pro modelo). Número sem fonte correspondente ou sem URL vira
// texto puro, sem colchete, pra não sobrar link quebrado.
function linkifyCitations(text, citations) {
  if (!text || !Array.isArray(citations) || citations.length === 0) return text;
  return text.replace(/\[(\d+)\]/g, (match, numStr) => {
    const citation = citations[Number(numStr) - 1];
    if (!citation?.url) return "";
    return `[[${numStr}]](${citation.url})`;
  });
}

// Links de citação abrem em nova aba, senão o usuário perde a conversa ao
// tentar voltar pelo botão "voltar" do navegador.
const markdownComponents = {
  a: ({ href, children, ...props }) => (
    <a href={href} target="_blank" rel="noreferrer" {...props}>
      {children}
    </a>
  ),
};

export default function ChatMessage({
  message,
  onRetry,
  supportUrl,
  supportLabel,
  supportContacts,
}) {
  const isUser = message.role === "user";

  if (message.isQueued) {
    return (
      <div className="flex justify-start">
        <QueueNotice
          until={message.queuedUntil}
          initialMs={message.queuedMs}
          reason={message.queuedReason}
          supportUrl={supportUrl}
          supportLabel={supportLabel}
          supportContacts={supportContacts}
          onRetry={onRetry}
        />
      </div>
    );
  }

  if (isUser) {
    return (
      <div className="flex justify-end">
        <div className="glass max-w-[80%] rounded-2xl px-4 py-3 text-sm font-medium text-white sm:px-5 sm:text-base">
          {message.text}
        </div>
      </div>
    );
  }

  if (message.pending && !message.text) {
    return (
      <div className="flex justify-start">
        <div className="flex items-center gap-1 py-3 pl-1">
          {[0, 150, 300].map((delay) => (
            <div
              key={delay}
              className="h-1.5 w-1.5 rounded-full bg-white animate-bounce shadow-[0_0_8px_white]"
              style={{ animationDelay: `${delay}ms` }}
              aria-hidden="true"
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="group flex justify-start">
      <div className="max-w-full sm:max-w-[780px]">
        <div className={`chat-md ${message.isError ? "text-red-400" : ""}`}>
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            rehypePlugins={[rehypeSanitize]}
            components={markdownComponents}
          >
            {linkifyCitations(message.text, message.citations)}
          </ReactMarkdown>
        </div>

        {!message.isError && (
          <MessageMeta
            modelUsed={message.modelUsed}
            usedFallback={message.usedFallback}
            sources={message.sources}
            sourcesStale={message.sourcesStale}
          />
        )}
      </div>
    </div>
  );
}
