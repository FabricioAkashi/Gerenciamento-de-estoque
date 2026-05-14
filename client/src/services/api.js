const API_URL = import.meta.env.VITE_API_URL || '/api';

async function request(path, options = {}) {
  const response = await fetch(`${API_URL}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers
    },
    ...options
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.message || 'Nao foi possivel concluir a operacao.');
  }

  if (response.status === 204) {
    return null;
  }

  return response.json();
}

export const api = {
  dashboard: () => request('/dashboard'),
  listarProdutos: () => request('/produtos'),
  criarProduto: (produto) =>
    request('/produtos', {
      method: 'POST',
      body: JSON.stringify(produto)
    }),
  atualizarProduto: (id, produto) =>
    request(`/produtos/${id}`, {
      method: 'PUT',
      body: JSON.stringify(produto)
    }),
  removerProduto: (id) =>
    request(`/produtos/${id}`, {
      method: 'DELETE'
    }),
  listarCategorias: () => request('/categorias'),
  criarCategoria: (categoria) =>
    request('/categorias', {
      method: 'POST',
      body: JSON.stringify(categoria)
    }),
  listarFornecedores: () => request('/fornecedores'),
  criarFornecedor: (fornecedor) =>
    request('/fornecedores', {
      method: 'POST',
      body: JSON.stringify(fornecedor)
    }),
  listarMovimentacoes: () => request('/movimentacoes?limit=50'),
  criarMovimentacao: (movimentacao) =>
    request('/movimentacoes', {
      method: 'POST',
      body: JSON.stringify(movimentacao)
    })
};
