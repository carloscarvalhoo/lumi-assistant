import { NextResponse } from "next/server";
import { adminAuth } from "@/server/firebase/admin";
import { checkRateLimit } from "@/server/chat/rateLimitStore";
import { getClientIp } from "@/server/utils/getClientIp";

const ADMIN_COOKIE_NAME = "firebase_admin_session";
const SESSION_EXPIRES_IN = 1000 * 60 * 60 * 8;

// Contra força bruta: bem mais apertado que o rate limit do chat, e num
// namespace separado (mesmo IP não compartilha cota com o chat público).
const LOGIN_MAX_ATTEMPTS = Number(process.env.LOGIN_RATE_LIMIT_MAX) || 8;
const LOGIN_WINDOW_MS = Number(process.env.LOGIN_RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000;

export async function POST(request) {
  const ip = getClientIp(request);
  const { allowed, retryAfterMs } = await checkRateLimit(ip, {
    namespace: "login",
    max: LOGIN_MAX_ATTEMPTS,
    windowMs: LOGIN_WINDOW_MS,
  });

  if (!allowed) {
    return NextResponse.json(
      {
        error: "Muitas tentativas de login. Aguarde alguns minutos e tente novamente.",
        retryAfterMs,
      },
      { status: 429 },
    );
  }

  try {
    const body = await request.json();
    const idToken = String(body?.idToken || "").trim();

    if (!idToken) {
      return NextResponse.json({ error: "Token de autenticação não enviado." }, { status: 400 });
    }

    await adminAuth.verifyIdToken(idToken);

    const sessionCookie = await adminAuth.createSessionCookie(idToken, {
      expiresIn: SESSION_EXPIRES_IN,
    });

    const response = NextResponse.json({
      success: true,
      message: "Login realizado com sucesso.",
    });

    response.cookies.set({
      name: ADMIN_COOKIE_NAME,
      value: sessionCookie,
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: SESSION_EXPIRES_IN / 1000,
    });

    return response;
  } catch (error) {
    console.error("Erro no login admin:", error);

    return NextResponse.json({ error: "E-mail ou senha inválidos." }, { status: 401 });
  }
}
