export async function loadAiChain() {
  const res = await fetch("/api/admin/compare", { credentials: "include" });
  if (!res.ok) return [];
  const data = await res.json().catch(() => null);
  return data?.chain || [];
}

export async function testResponse({ mode, question }) {
  const endpoint = mode === "compare" ? "/api/admin/compare" : "/api/admin/search";

  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ message: question }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data?.error || "Erro ao testar.");
  return data;
}
