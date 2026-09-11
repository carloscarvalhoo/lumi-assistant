/**
 * @file Helper pra transformar uma função assíncrona com callback de progresso
 * num stream Server-Sent Events (SSE), usado pelas rotas de verificação/
 * reindexação em massa pra mostrar progresso em tempo real no painel em vez
 * de um spinner genérico até a resposta inteira voltar.
 * @module server/utils/sse
 */

const encoder = new TextEncoder();

function frame(event, data) {
  return encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

/**
 * @param {(onProgress: (progress: object) => void) => Promise<object>} run
 *   Recebe uma função `onProgress` pra emitir eventos "progress" e deve
 *   devolver o resultado final (emitido como evento "done"). Se lançar, um
 *   evento "error" é emitido no lugar.
 * @returns {ReadableStream}
 */
export function createProgressStream(run) {
  return new ReadableStream({
    async start(controller) {
      // Se o cliente desconectar (fechou a aba, servidor reiniciou) antes do
      // fim, o controller fecha e enqueue/close passam a lançar
      // ERR_INVALID_STATE — o trabalho em si (verificação/reindexação) já
      // está rodando em background e não deve travar por causa disso.
      let closed = false;
      const safeEnqueue = (chunk) => {
        if (closed) return;
        try {
          controller.enqueue(chunk);
        } catch {
          closed = true;
        }
      };
      const onProgress = (progress) => safeEnqueue(frame("progress", progress));
      try {
        const result = await run(onProgress);
        safeEnqueue(frame("done", result));
      } catch (error) {
        safeEnqueue(frame("error", { message: error?.message || "Erro inesperado." }));
      } finally {
        if (!closed) {
          try {
            controller.close();
          } catch {
            // Cliente já desconectou — nada a fazer.
          }
        }
      }
    },
  });
}

export const SSE_HEADERS = {
  "Content-Type": "text/event-stream",
  "Cache-Control": "no-cache, no-transform",
  Connection: "keep-alive",
};
