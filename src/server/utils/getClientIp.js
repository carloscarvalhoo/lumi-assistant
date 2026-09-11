/**
 * @file Extrai o IP real do cliente por trás do proxy da plataforma.
 * @module server/utils/getClientIp
 */

/**
 * @param {Request} request
 * @returns {string}
 */
export function getClientIp(request) {
  // x-real-ip é preenchido pelo proxy da plataforma (Vercel) e não é
  // sobrescrevível pelo cliente. Preferimos ele.
  const realIp = request.headers.get("x-real-ip");
  if (realIp) {
    return realIp.trim();
  }

  // Em x-forwarded-for o cliente consegue PREPENDAR entradas falsas, mas a
  // última entrada é a que o proxy confiável adicionou. Usamos essa.
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    const parts = forwardedFor
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean);
    if (parts.length) {
      return parts[parts.length - 1];
    }
  }

  return "local";
}
