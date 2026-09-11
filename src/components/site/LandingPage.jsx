"use client";

import Link from "next/link";

export default function LandingPage({ settings = {} }) {
  const name = settings.botName || "ELO";
  const institution = settings.institutionName || "Instituição";

  return (
    <main className="relative min-h-screen overflow-hidden text-white">
      {/* Header */}
      <header className="glass-subtle fixed left-0 top-0 z-50 w-full border-x-0! border-t-0!">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:h-20 sm:px-6">
          <Link href="/" className="text-base font-semibold tracking-wide text-zinc-100 sm:text-lg">
            {name}
          </Link>

          <nav className="hidden items-center gap-6 text-sm font-medium text-zinc-400 md:flex">
            <a href="#sobre" className="transition hover:text-white">
              Sobre
            </a>
            <a href="#funciona" className="transition hover:text-white">
              Como funciona
            </a>
            <a href="#seguranca" className="transition hover:text-white">
              Segurança
            </a>
          </nav>

          <Link
            href="/chat"
            className="glass glass-hover rounded-full px-4 py-2 text-sm font-medium text-white transition sm:px-5 sm:py-3"
          >
            Acessar o {name}
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="relative z-10 flex min-h-[68svh] items-center justify-center px-4 pt-20 sm:min-h-screen sm:px-6 sm:pt-24">
        <div className="mx-auto max-w-5xl text-center animate-in fade-in slide-in-from-bottom-8 duration-700">
          <h1 className="mx-auto max-w-4xl bg-gradient-to-r from-zinc-100 via-zinc-300 to-zinc-500 bg-clip-text text-4xl font-medium text-transparent sm:text-5xl md:text-7xl">
            Conheça o <span className="font-bold text-white">{name}.</span>
          </h1>

          <p className="mx-auto mt-6 max-w-2xl text-sm leading-7 text-zinc-400 sm:mt-8 sm:text-base md:text-lg">
            O assistente virtual da {institution}. Pergunte sobre editais, cursos, prazos e serviços
            e receba a resposta na hora, em uma conversa.
          </p>

          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:mt-10 sm:flex-row sm:gap-4">
            <Link
              href="/chat"
              className="w-full rounded-full bg-white px-7 py-4 text-base font-semibold text-black transition hover:bg-zinc-200 sm:w-auto"
            >
              Conversar com o {name}
            </Link>
            <a
              href="#sobre"
              className="w-full rounded-full border border-white/10 px-7 py-4 text-base font-semibold text-white transition hover:bg-white/5 sm:w-auto"
            >
              Entender o sistema
            </a>
          </div>
        </div>
      </section>

      {/* Sobre */}
      <section
        id="sobre"
        className="relative z-10 border-t border-white/5 px-4 py-14 bg-black/10 sm:px-6 sm:py-24"
      >
        <div className="mx-auto grid max-w-7xl gap-4 md:grid-cols-[0.8fr_1.2fr] md:gap-12">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.25em] text-zinc-500">
              O Sistema
            </p>
          </div>
          <div>
            <h2 className="text-2xl font-medium leading-tight text-zinc-100 md:text-4xl">
              Menos tempo procurando, mais tempo resolvendo.
            </h2>
            <p className="mt-5 text-sm leading-7 text-zinc-400 sm:mt-6 sm:text-base">
              Editais, calendários e páginas de serviço costumam estar espalhados em lugares
              diferentes do site. O {name} reúne esse conteúdo num só lugar e responde em linguagem
              natural, sem precisar navegar por menus ou abrir PDF nenhum.
            </p>
            <p className="mt-4 text-sm leading-7 text-zinc-400 sm:text-base">
              A conversa continua de onde parou: dá pra perguntar de novo, pedir mais detalhes ou
              mudar de assunto que o contexto não se perde.
            </p>
          </div>
        </div>
      </section>

      {/* Como Funciona */}
      <section
        id="funciona"
        className="relative z-10 border-t border-white/5 px-4 py-14 sm:px-6 sm:py-24"
      >
        <div className="mx-auto max-w-7xl">
          <div className="mb-10 max-w-3xl sm:mb-14">
            <p className="text-sm font-semibold uppercase tracking-[0.25em] text-zinc-500">
              Como funciona
            </p>
            <h2 className="mt-5 text-2xl font-medium leading-tight text-zinc-100 sm:mt-6 md:text-4xl">
              Da pergunta à resposta em segundos.
            </h2>
          </div>

          <div className="grid gap-4 sm:gap-6 md:grid-cols-3">
            {[
              {
                n: "01",
                title: "Base de conhecimento",
                desc: `A equipe sobe PDFs e indexa páginas do site. O sistema gera embeddings semânticos para cada trecho de conteúdo.`,
              },
              {
                n: "02",
                title: "Busca inteligente",
                desc: `Cada pergunta é comparada semanticamente com os trechos cadastrados. O ${name} encontra o conteúdo mais relevante mesmo com palavras diferentes.`,
              },
              {
                n: "03",
                title: "Resposta com fonte",
                desc: `A resposta é montada a partir dos trechos encontrados, e você vê de qual página ou documento ela veio.`,
              },
            ].map(({ n, title, desc }) => (
              <div key={n} className="glass rounded-3xl p-5 sm:p-7">
                <span className="text-sm font-medium text-zinc-600">{n}</span>
                <h3 className="mt-3 text-base font-semibold text-zinc-200 sm:mt-4 sm:text-lg">
                  {title}
                </h3>
                <p className="mt-2 text-sm leading-6 text-zinc-400 sm:mt-3">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA intermediário */}
      <section className="relative z-10 px-4 py-10 sm:px-6 sm:py-14">
        <div className="glass mx-auto flex max-w-4xl flex-col items-center gap-5 rounded-3xl p-6 text-center sm:flex-row sm:justify-between sm:p-8 sm:text-left">
          <div>
            <p className="text-base font-semibold text-zinc-100 sm:text-lg">
              Gratuito, sem cadastro, sem senha.
            </p>
            <p className="mt-1 text-sm text-zinc-400 sm:text-base">
              É só abrir e perguntar: o {name} já responde na primeira mensagem, sem custo nenhum.
            </p>
            <div className="mt-3 flex flex-wrap items-center justify-center gap-2 sm:justify-start">
              <span className="glass-subtle rounded-full px-3 py-1 text-xs text-zinc-400">
                Disponível 24h
              </span>
              <span className="glass-subtle rounded-full px-3 py-1 text-xs text-zinc-400">
                Resposta em segundos
              </span>
            </div>
          </div>
          <Link
            href="/chat"
            className="w-full shrink-0 rounded-full bg-white px-6 py-3 text-sm font-semibold text-black transition hover:bg-zinc-200 sm:w-auto"
          >
            Abrir o {name}
          </Link>
        </div>
      </section>

      {/* Segurança */}
      <section
        id="seguranca"
        className="relative z-10 border-t border-white/5 px-4 py-14 sm:px-6 sm:py-24"
      >
        <div className="mx-auto grid max-w-7xl gap-4 md:grid-cols-2 md:gap-12">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.25em] text-zinc-500">
              Segurança e Limites
            </p>
            <h2 className="mt-5 text-2xl font-medium leading-tight text-zinc-100 sm:mt-6 md:text-4xl">
              Respostas dentro dos limites do que foi configurado.
            </h2>
          </div>

          <div className="space-y-4 text-sm leading-7 text-zinc-400 sm:text-base">
            <p>
              O {name} responde apenas com base nos documentos e páginas cadastradas pela equipe
              responsável. Não realiza buscas na internet nem inventa informações.
            </p>
            <p>
              Quando não encontra a resposta, orienta o usuário a buscar os canais oficiais de forma
              gentil e transparente.
            </p>
            <p className="glass rounded-xl p-4 text-xs text-amber-200/90 shadow-[inset_0_0_0_1px_rgba(251,191,36,0.14)] sm:rounded-2xl sm:p-5 sm:text-sm">
              As informações apresentadas devem ser confirmadas pelos canais de atendimento
              oficiais.
            </p>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="relative z-10 border-t border-white/5 px-4 py-14 bg-black/10 sm:px-6 sm:py-24">
        <div className="mx-auto max-w-4xl text-center">
          <h2 className="text-2xl font-medium text-zinc-100 sm:text-3xl md:text-4xl">
            Bora testar?
          </h2>
          <p className="mt-4 text-sm text-zinc-400 sm:text-base">
            Manda a primeira pergunta e veja o {name} responder na hora.
          </p>
          <Link
            href="/chat"
            className="mt-6 inline-flex rounded-full bg-white px-6 py-3 text-sm font-semibold text-black transition hover:bg-zinc-200 sm:mt-8 sm:px-7 sm:py-4 sm:text-base"
          >
            Iniciar conversa
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="glass-subtle relative z-10 border-x-0! border-b-0! px-4 py-8 sm:px-6 sm:py-10">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 text-xs text-zinc-600 sm:text-sm md:flex-row md:items-center md:justify-between">
          <div className="flex flex-col gap-1">
            <p>{name} • Assistente Inteligente de Atendimento Institucional</p>
            <p className="text-zinc-500">
              O {name} pode cometer erros. Consulte o setor responsável quando necessário.
            </p>
          </div>
          <p className="font-medium text-zinc-400">Carlos Carvalho</p>
        </div>
      </footer>
    </main>
  );
}
