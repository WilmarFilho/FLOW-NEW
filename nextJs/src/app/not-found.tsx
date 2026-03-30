import { redirect } from 'next/navigation';

export default function NotFoundPage() {
  // Pelo proxy.ts, quem cai aqui sem login já é redirecionado para /login.
  // Então, os usuários que atingem este componente sempre estão logados.
  redirect('/home');
}
