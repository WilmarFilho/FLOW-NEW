export function useFormatDate(dateString: string): string {
  if (!dateString) return '';

  // normaliza: aceita " " ou "T", remove microsegundos extras (mantém milissegundos)
  let iso = dateString.trim().replace(' ', 'T').replace(/(\.\d{3})\d+/, '$1');

  // se NÃO tiver timezone no final (Z ou +hh:mm / -hh:mm), assume UTC
  if (!/[zZ]|[+-]\d{2}:\d{2}$/.test(iso) && !/[+-]\d{4}$/.test(iso)) {
    iso = iso + 'Z';
  }

  const date = new Date(iso);
  if (isNaN(date.getTime())) {
    // fallback simples: se der problema no parse, retorna string original curta
    return dateString;
  }

  const now = new Date();

  const isSameDay =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();

  if (isSameDay) {
    // hora/minuto ajustado para timezone local
    return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  } else {
    return date.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  }
}
