export function moeda(valor) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(valor || 0);
}

export function dataCurta(valor) {
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short'
  }).format(new Date(valor));
}

export function numero(valor) {
  return Number(valor || 0).toLocaleString('pt-BR');
}

export function rotuloTipoMovimentacao(tipo) {
  if (tipo === 'entrada') return 'Entrada';
  if (tipo === 'saida') return 'Saída';
  if (tipo === 'ajuste') return 'Ajuste';
  return tipo || '-';
}
