/**
 * @file Validação e sanitização da entrada da rota de chat + rate limit por IP.
 * @module server/chat/chatGuards
 */

import { createHttpError } from "@/server/utils/errors";
import { checkRateLimit } from "@/server/chat/rateLimitStore";
import { getClientIp } from "@/server/utils/getClientIp";

const MAX_MESSAGE_LENGTH = 1000;
const MAX_BUFFER_MESSAGES = 24;
const MAX_SINGLE_HISTORY_MESSAGE_LENGTH = 1500;
const MAX_LONG_MEMORY_LENGTH = 6000;

export async function checkChatRateLimit(request) {
  // Bypass para a bateria de avaliação (scripts/eval-accuracy.mjs). Nunca vale
  // em produção — lá o EVAL_SECRET não deve nem existir.
  const evalSecret = process.env.EVAL_SECRET;
  if (
    process.env.NODE_ENV !== "production" &&
    evalSecret &&
    request.headers.get("x-eval-secret") === evalSecret
  ) {
    return;
  }

  const ip = getClientIp(request);
  const { allowed, retryAfterMs } = await checkRateLimit(ip);

  if (!allowed) {
    const error = createHttpError(
      "Muitas mensagens enviadas em pouco tempo. Aguarde alguns minutos e tente novamente.",
      429,
    );
    error.retryAfterMs = retryAfterMs;
    error.reason = "rate_limit";
    throw error;
  }
}

export function validateChatMessage(message) {
  const cleanMessage = String(message || "").trim();

  if (!cleanMessage) {
    throw createHttpError("Digite uma mensagem para começar.", 400);
  }

  if (cleanMessage.length > MAX_MESSAGE_LENGTH) {
    throw createHttpError(
      `Mensagem muito longa. Envie uma pergunta com até ${MAX_MESSAGE_LENGTH} caracteres.`,
      400,
    );
  }

  return cleanMessage;
}

export function sanitizeBufferHistory(bufferHistory) {
  if (!Array.isArray(bufferHistory)) {
    return [];
  }

  return bufferHistory
    .slice(-MAX_BUFFER_MESSAGES)
    .map((message) => {
      const role = message?.role === "model" ? "model" : "user";
      const text = String(message?.text || "")
        .trim()
        .slice(0, MAX_SINGLE_HISTORY_MESSAGE_LENGTH);

      return {
        role,
        text,
      };
    })
    .filter((message) => message.text);
}

export function sanitizeLongMemory(longMemory) {
  if (!longMemory) return null;

  return String(longMemory || "")
    .trim()
    .slice(0, MAX_LONG_MEMORY_LENGTH);
}
