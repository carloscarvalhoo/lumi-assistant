/**
 * @file Decide, antes de cada mensagem, se vale a pena buscar na base de
 * conhecimento institucional ou se é só conversa (saudação, apresentação
 * pessoal, comentário solto). Sem isso, toda mensagem — até "oi" ou "eu
 * gosto de verde" — disparava uma busca semântica, gastando embeddings à
 * toa e arriscando trazer trechos irrelevantes pro contexto do modelo.
 * @module server/ai/intentGate
 */

import {
  createOpenAICompatibleProvider,
  isConfigured,
} from "@/server/ai/providers/openaiCompatibleProvider";
import { logger } from "@/server/utils/logger";

// Modelo pequeno e rápido só pra classificar — não precisa da qualidade dos
// modelos usados pra responder de verdade.
const CLASSIFIER_MODEL = process.env.INTENT_GATE_MODEL || "openai/gpt-oss-20b";

function buildPrompt(message) {
  return `Classifique a mensagem de um usuário de um chat institucional em UMA destas duas categorias:

BUSCAR: a mensagem pede alguma informação factual sobre a instituição (cursos, editais, prazos, matrícula, documentos, contatos, benefícios, calendário, normas, serviços etc.) ou faz uma pergunta que só a instituição saberia responder.
CONVERSAR: a mensagem é saudação, despedida, agradecimento, apresentação pessoal, comentário solto, elogio, desabafo, ou qualquer coisa que não pede um fato institucional específico.

Mensagem: "${message}"

Responda com UMA ÚNICA PALAVRA, exatamente "BUSCAR" ou "CONVERSAR". Nada mais.`;
}

/**
 * @param {string} message
 * @returns {Promise<boolean>} true = deve buscar na base; false = só conversa
 */
export async function shouldSearchKnowledge(message) {
  const text = String(message || "").trim();
  if (!text) return false;

  // Sem Groq configurado, não dá pra classificar barato — mantém o
  // comportamento antigo (busca sempre) em vez de arriscar pular buscas
  // válidas.
  if (!isConfigured("groq")) return true;

  try {
    const provider = createOpenAICompatibleProvider("groq", CLASSIFIER_MODEL);
    const { text: result } = await provider.generateText({ prompt: buildPrompt(text) });
    return result.trim().toUpperCase().includes("BUSCAR");
  } catch (error) {
    // Falha na classificação: melhor buscar à toa do que arriscar nunca
    // achar uma pergunta real por causa de um erro na etapa de triagem.
    logger.warn(
      `⚠️ Falha ao classificar intenção da mensagem, buscando por padrão: ${error?.message}`,
    );
    return true;
  }
}
