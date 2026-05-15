const API_URL = import.meta.env.VITE_API_URL || '/api';
const TOKEN_KEY = 'estoque-auth-token';

let authToken = window.localStorage.getItem(TOKEN_KEY) || '';

export function setAuthToken(token) {
  authToken = token || '';

  if (authToken) {
    window.localStorage.setItem(TOKEN_KEY, authToken);
    return;
  }

  window.localStorage.removeItem(TOKEN_KEY);
}

export function getAuthToken() {
  return authToken;
}

async function request(path, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers
  };

  if (authToken) {
    headers.Authorization = `Bearer ${authToken}`;
  }

  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers
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
  authStatus: () => request('/auth/status'),
  setupAdmin: (dados) =>
    request('/auth/setup', {
      method: 'POST',
      body: JSON.stringify(dados)
    }),
  login: (dados) =>
    request('/auth/login', {
      method: 'POST',
      body: JSON.stringify(dados)
    }),
  perfil: () => request('/auth/me'),
  listarUsuarios: () => request('/auth/usuarios'),
  criarUsuario: (usuario) =>
    request('/auth/usuarios', {
      method: 'POST',
      body: JSON.stringify(usuario)
    }),
  atualizarUsuario: (id, usuario) =>
    request(`/auth/usuarios/${id}`, {
      method: 'PUT',
      body: JSON.stringify(usuario)
    }),
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