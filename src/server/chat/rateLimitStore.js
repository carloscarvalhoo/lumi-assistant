/**
 * @file Rate limit híbrido, reutilizável por qualquer rota: contador em memória
 * por instância + Firestore quando o IP se aproxima do limite. Usado tanto no
 * chat público quanto no login do admin (contra força bruta).
 * @module server/chat/rateLimitStore
 */

import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/server/firebase/admin";
import { logger } from "@/server/utils/logger";

const DEFAULT_WINDOW_MS = Number(process.env.RATE_LIMIT_WINDOW_MS) || 10 * 60 * 1000;
const DEFAULT_MAX_REQUESTS = Number(process.env.RATE_LIMIT_MAX) || 20;

// Cache local por instância: evita ir ao Firestore quando o IP está claramente
// dentro do limite. Só consulta o banco quando passa da metade da cota.
const local = new Map();

function bump(mapKey, now, windowMs) {
  const entry = local.get(mapKey);
  if (!entry || now - entry.windowStartedAt > windowMs) {
    const fresh = { count: 1, windowStartedAt: now };
    local.set(mapKey, fresh);
    return fresh;
  }
  entry.count += 1;
  return entry;
}

function docRef(namespace, key) {
  const id = encodeURIComponent(`${namespace}:${key}`).slice(0, 200);
  return adminDb.collection("rateLimits").doc(id);
}

/**
 * @param {string} key            geralmente o IP do cliente
 * @param {{ max?: number, windowMs?: number, namespace?: string }} [options]
 *   `namespace` isola o contador (ex: "chat" vs "login") mesmo para o mesmo IP.
 * @returns {Promise<{ allowed: boolean, retryAfterMs: number }>}
 */
export async function checkRateLimit(key, options = {}) {
  const max = options.max ?? DEFAULT_MAX_REQUESTS;
  const windowMs = options.windowMs ?? DEFAULT_WINDOW_MS;
  const namespace = options.namespace || "chat";
  const softThreshold = Math.ceil(max / 2);
  const mapKey = `${namespace}:${key}`;

  const now = Date.now();
  const localEntry = bump(mapKey, now, windowMs);

  // Limite local é fonte da verdade para abuso de uma mesma instância
  // (o caso comum: um cliente martelando). Bloqueia sempre que estourar.
  if (localEntry.count > max) {
    return {
      allowed: false,
      retryAfterMs: Math.max(1000, localEntry.windowStartedAt + windowMs - now),
    };
  }

  // Caminho quente: claramente dentro do limite → nem toca no Firestore.
  if (localEntry.count <= softThreshold) {
    return { allowed: true, retryAfterMs: 0 };
  }

  // Perto do limite (ou tráfego distribuído entre instâncias) → fonte da verdade
  // é o Firestore. Custo: 1 leitura + 1 escrita, só nesse caso.
  try {
    const ref = docRef(namespace, key);
    const snap = await ref.get();
    const data = snap.exists ? snap.data() : null;
    const windowStartedAt = data?.windowStartedAt?.toMillis?.() ?? data?.windowStartedAt ?? 0;
    const expired = now - windowStartedAt > windowMs;
    const count = expired ? 0 : data?.count || 0;

    if (count >= max) {
      return { allowed: false, retryAfterMs: Math.max(1000, windowStartedAt + windowMs - now) };
    }

    await ref.set(
      expired
        ? { count: 1, windowStartedAt: now }
        : { count: FieldValue.increment(1), windowStartedAt: windowStartedAt || now },
      { merge: true },
    );
    return { allowed: true, retryAfterMs: 0 };
  } catch (error) {
    // Se o Firestore falhar, cai no limite local (melhor que bloquear tudo).
    logger.warn("Rate limit: Firestore indisponível, usando limite local:", error?.message);
    const allowed = localEntry.count <= max;
    return {
      allowed,
      retryAfterMs: allowed ? 0 : localEntry.windowStartedAt + windowMs - now,
    };
  }
}
