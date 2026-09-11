export async function loadBasePrompt() {
  const res = await fetch("/api/admin/prompt", { credentials: "include" });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error || "Erro ao carregar o prompt.");
  return data;
}

export async function loadPromptForQuestion(question) {
  const res = await fetch("/api/admin/prompt", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ question }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error || "Erro ao montar o prompt.");
  return data;
}
