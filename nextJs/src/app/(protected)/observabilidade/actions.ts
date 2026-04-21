'use server';

export async function validateObserverSecret(secret: string) {
  // Acessar no ambiente de execução (runtime), evitando que quebre se não for passado na imagem docker durante o build.
  // E também garante segurança por não injetar a senha no .js público.
  return secret === process.env.NEXT_PUBLIC_OBSERVER_SECRET_KEY;
}
