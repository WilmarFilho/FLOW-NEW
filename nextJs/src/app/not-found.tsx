import Link from 'next/link';

export default function NotFoundPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[linear-gradient(180deg,rgba(8,16,31,1)_0%,rgba(5,10,20,1)_100%)] px-6">
      <div className="w-full max-w-xl rounded-[28px] border border-white/10 bg-white/5 p-8 text-center text-white shadow-[var(--shadow-elevated)] backdrop-blur-xl">
        <span className="text-[12px] font-bold uppercase tracking-[0.18em] text-white/40">
          Error 404
        </span>
        <h1 className="mt-4 text-[34px] font-extrabold leading-tight">
          Esta página não existe
        </h1>
        <p className="mt-3 text-[15px] leading-7 text-white/58">
          O endereço pode estar incorreto ou o conteúdo pode ter sido movido.
        </p>
        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          <Link
            href="/home"
            className="inline-flex min-h-[48px] items-center justify-center rounded-[16px] bg-[linear-gradient(135deg,#ffe664_0%,var(--color-secondary)_100%)] px-5 font-bold text-[var(--color-aux-black)] transition hover:-translate-y-0.5"
          >
            Ir para a home
          </Link>
          <Link
            href="/conversas"
            className="inline-flex min-h-[48px] items-center justify-center rounded-[16px] border border-white/10 bg-white/5 px-5 font-semibold text-white/78 transition hover:bg-white/10 hover:text-white"
          >
            Abrir conversas
          </Link>
        </div>
      </div>
    </main>
  );
}
