'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function RoleGuard({ tipoUsuario }: { tipoUsuario: string }) {
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (tipoUsuario === 'atendente') {
      const allowedPaths = ['/conversas', '/configuracoes', '/ajuda'];
      if (!allowedPaths.some(p => pathname.startsWith(p))) {
        router.replace('/conversas');
      }
    }
  }, [pathname, tipoUsuario, router]);

  return null;
}
