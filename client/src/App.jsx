import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  Boxes,
  CheckCircle2,
  LogOut,
  Moon,
  ShieldCheck,
  PackagePlus,
  RefreshCw,
  Save,
  Search,
  SlidersHorizontal,
  Sun,
  UserPlus,
  Users,
  Trash2,
  X,
  Truck
} from 'lucide-react';
import React from 'react';
import { useEffect, useMemo, useState } from 'react';
import { EmptyState } from './components/EmptyState.jsx';
import { MetricCard } from './components/MetricCard.jsx';
import { api, getAuthToken, setAuthToken } from './services/api.js';

const produtoInicial = {
  nome: '',
  categoria: '',
  fornecedor: '',
  quantidadeAtual: 0,
  unidadeMedida: 'un',
  estoqueMinimo: 5,
  precoUnitario: 0
};

const categoriaInicial = { nome: '', descricao: '' };
const fornecedorInicial = { nome: '', cnpj: '', telefone: '', email: '', endereco: '' };
const filtrosProdutoInicial = { categoria: '', fornecedor: '', status: '' };
const LIMITE_MOVIMENTACOES_VISIVEIS = 6;
const TEMA_PADRAO = 'claro';
const PERIODOS_RESUMO = {
  dia: { label: '1 dia', dias: 1 },
  semana: { label: '1 semana', dias: 7 },
  mes: { label: '1 mes', dias: 30 }
};
const movimentacaoInicial = {
  produto: '',
  tipo: 'entrada',
  quantidade: 1,
  usuario: 'Operador',
  observacao: ''
};
const loginInicial = { nome: '', email: '', senha: '' };
const usuarioInicial = {
  nome: '',
  email: '',
  senha: '',
  papel: 'operador',
  ativo: true,
  senhaConfirmacao: ''
};

function moeda(valor) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(valor || 0);
}

function dataCurta(valor) {
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short'
  }).format(new Date(valor));
}

function numero(valor) {
  return Number(valor || 0).toLocaleString('pt-BR');
}

function temaInicial() {
  if (typeof window === 'undefined') {
    return TEMA_PADRAO;
  }

  const temaSalvo = window.localStorage.getItem('tema-estoque');
  return temaSalvo === 'escuro' ? 'escuro' : TEMA_PADRAO;
}

export default function App() {
  const [dashboard, setDashboard] = useState(null);
  const [produtos, setProdutos] = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [fornecedores, setFornecedores] = useState([]);
  const [movimentacoes, setMovimentacoes] = useState([]);
  const [produto, setProduto] = useState(produtoInicial);
  const [categoria, setCategoria] = useState(categoriaInicial);
  const [fornecedor, setFornecedor] = useState(fornecedorInicial);
  const [movimentacao, setMovimentacao] = useState(movimentacaoInicial);
  const [busca, setBusca] = useState('');
  const [filtrosProduto, setFiltrosProduto] = useState(filtrosProdutoInicial);
  const [ordenacaoProdutos, setOrdenacaoProdutos] = useState({ campo: 'nome', direcao: 'asc' });
  const [produtoEditando, setProdutoEditando] = useState(null);
  const [produtoEdicao, setProdutoEdicao] = useState(null);
  const [aba, setAba] = useState('produto');
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [mensagem, setMensagem] = useState('');
  const [erro, setErro] = useState('');
  const [precoEmEdicao, setPrecoEmEdicao] = useState(null);
  const [movimentacaoSelecionada, setMovimentacaoSelecionada] = useState(null);
  const [fornecedorSelecionado, setFornecedorSelecionado] = useState(null);
  const [mostrarMovimentacoesAntigas, setMostrarMovimentacoesAntigas] = useState(false);
  const [resumoAberto, setResumoAberto] = useState(false);
  const [periodoResumo, setPeriodoResumo] = useState('dia');
  const [tema, setTema] = useState(temaInicial);
  const [usuarioLogado, setUsuarioLogado] = useState(null);
  const [authCarregando, setAuthCarregando] = useState(true);
  const [setupNecessario, setSetupNecessario] = useState(false);
  const [loginForm, setLoginForm] = useState(loginInicial);
  const [usuarios, setUsuarios] = useState([]);
  const [usuarioForm, setUsuarioForm] = useState(usuarioInicial);
  const [usuarioEditando, setUsuarioEditando] = useState(null);

  const admin = usuarioLogado?.papel === 'admin';

  async function carregarDados() {
    setCarregando(true);
    setErro('');

    const resultados = await Promise.allSettled([
      api.dashboard(),
      api.listarProdutos(),
      api.listarCategorias(),
      api.listarFornecedores(),
      api.listarMovimentacoes()
    ]);

    const [dashboardDados, produtosDados, categoriasDados, fornecedoresDados, movimentacoesDados] =
      resultados;

    if (dashboardDados.status === 'fulfilled') {
      setDashboard(dashboardDados.value);
    }

    if (produtosDados.status === 'fulfilled') {
      setProdutos(produtosDados.value);
    }

    if (categoriasDados.status === 'fulfilled') {
      setCategorias(categoriasDados.value);
    }

    if (fornecedoresDados.status === 'fulfilled') {
      setFornecedores(fornecedoresDados.value);
    }

    if (movimentacoesDados.status === 'fulfilled') {
      setMovimentacoes(movimentacoesDados.value);
    }

    const primeiraFalha = resultados.find((resultado) => resultado.status === 'rejected');

    if (primeiraFalha) {
      setErro(
        'A tela abriu, mas a API nao respondeu. Confira se o backend esta rodando e se o MongoDB Atlas autenticou corretamente.'
      );
    }

    setCarregando(false);
  }
  async function carregarUsuarios() {
    if (!admin) {
      return;
    }

    const lista = await api.listarUsuarios();
    setUsuarios(lista);
  }

  async function autenticar(event) {
    event.preventDefault();
    setErro('');
    setMensagem('');
    setSalvando(true);

    try {
      const resposta = setupNecessario
        ? await api.setupAdmin(loginForm)
        : await api.login({ email: loginForm.email, senha: loginForm.senha });

      setAuthToken(resposta.token);
      setUsuarioLogado(resposta.usuario);
      setSetupNecessario(false);
      setLoginForm(loginInicial);
      setMensagem(setupNecessario ? 'Administrador criado com sucesso.' : 'Login realizado.');
      await carregarDados();
    } catch (error) {
      setErro(error.message);
    } finally {
      setAuthCarregando(false);
      setSalvando(false);
    }
  }

  function sair() {
    setAuthToken('');
    setUsuarioLogado(null);
    setDashboard(null);
    setProdutos([]);
    setCategorias([]);
    setFornecedores([]);
    setMovimentacoes([]);
    setUsuarios([]);
    setMensagem('');
    setErro('');
    api.authStatus().then((status) => setSetupNecessario(status.setupNecessario)).catch(() => {});
  }

  async function salvarUsuario(event) {
    event.preventDefault();
    setErro('');
    setMensagem('');
    setSalvando(true);

    try {
      if (usuarioEditando) {
        await api.atualizarUsuario(usuarioEditando._id, usuarioForm);
        setMensagem('Usuario atualizado.');
      } else {
        await api.criarUsuario(usuarioForm);
        setMensagem('Usuario cadastrado.');
      }

      setUsuarioForm(usuarioInicial);
      setUsuarioEditando(null);
      await carregarUsuarios();
    } catch (error) {
      setErro(error.message);
    } finally {
      setSalvando(false);
    }
  }

  function editarUsuario(item) {
    setUsuarioEditando(item);
    setUsuarioForm({
      nome: item.nome,
      email: item.email,
      senha: '',
      papel: item.papel,
      ativo: item.ativo,
      senhaConfirmacao: ''
    });
  }

  function cancelarEdicaoUsuario() {
    setUsuarioEditando(null);
    setUsuarioForm(usuarioInicial);
  }

  useEffect(() => {
    async function iniciarSessao() {
      setAuthCarregando(true);
      setErro('');

      try {
        if (getAuthToken()) {
          const perfil = await api.perfil();
          setUsuarioLogado(perfil);
          await carregarDados();
          return;
        }

        const status = await api.authStatus();
        setSetupNecessario(status.setupNecessario);
      } catch (error) {
        setAuthToken('');
        setErro(error.message);
      } finally {
        setAuthCarregando(false);
      }
    }

    iniciarSessao();
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = tema;
    window.localStorage.setItem('tema-estoque', tema);
  }, [tema]);

  useEffect(() => {
    if (admin) {
      carregarUsuarios().catch((error) => setErro(error.message));
    }
  }, [admin]);

  useEffect(() => {
    function fecharComEsc(event) {
      if (event.key === 'Escape') {
        setMovimentacaoSelecionada(null);
        setFornecedorSelecionado(null);
        setProdutoEditando(null);
        setProdutoEdicao(null);
        setResumoAberto(false);
      }
    }

    window.addEventListener('keydown', fecharComEsc);
    return () => window.removeEventListener('keydown', fecharComEsc);
  }, []);

  const produtosFiltrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();

    const lista = produtos.filter((item) => {
      const correspondeBusca = termo
        ? [item.nome, item.categoria?.nome, item.fornecedor?.nome, item.unidadeMedida]
            .filter(Boolean)
            .some((valor) => valor.toLowerCase().includes(termo))
        : true;
      const correspondeCategoria = filtrosProduto.categoria
        ? (item.categoria?._id || item.categoria) === filtrosProduto.categoria
        : true;
      const correspondeFornecedor = filtrosProduto.fornecedor
        ? (item.fornecedor?._id || item.fornecedor) === filtrosProduto.fornecedor
        : true;
      const correspondeStatus = filtrosProduto.status
        ? filtrosProduto.status === 'alerta'
          ? item.emAlerta
          : !item.emAlerta
        : true;

      return correspondeBusca && correspondeCategoria && correspondeFornecedor && correspondeStatus;
    });

    const valorCampo = (item) => {
      if (ordenacaoProdutos.campo === 'nome') return item.nome || '';
      if (ordenacaoProdutos.campo === 'categoria') return item.categoria?.nome || '';
      if (ordenacaoProdutos.campo === 'fornecedor') return item.fornecedor?.nome || '';
      if (ordenacaoProdutos.campo === 'quantidadeAtual') return Number(item.quantidadeAtual || 0);
      if (ordenacaoProdutos.campo === 'estoqueMinimo') return Number(item.estoqueMinimo || 0);
      if (ordenacaoProdutos.campo === 'precoUnitario') return Number(item.precoUnitario || 0);
      if (ordenacaoProdutos.campo === 'status') return item.emAlerta ? 1 : 0;
      return item.nome || '';
    };

    return [...lista].sort((a, b) => {
      const valorA = valorCampo(a);
      const valorB = valorCampo(b);
      const direcao = ordenacaoProdutos.direcao === 'asc' ? 1 : -1;

      if (typeof valorA === 'number' && typeof valorB === 'number') {
        return (valorA - valorB) * direcao;
      }

      return String(valorA).localeCompare(String(valorB), 'pt-BR', { sensitivity: 'base' }) * direcao;
    });
  }, [busca, filtrosProduto, ordenacaoProdutos, produtos]);

  function alternarOrdenacao(campo) {
    setOrdenacaoProdutos((atual) => ({
      campo,
      direcao: atual.campo === campo && atual.direcao === 'asc' ? 'desc' : 'asc'
    }));
  }

  function indicadorOrdenacao(campo) {
    if (ordenacaoProdutos.campo !== campo) {
      return '--';
    }

    return ordenacaoProdutos.direcao === 'asc' ? 'A-Z' : 'Z-A';
  }

  function limparFiltrosProduto() {
    setBusca('');
    setFiltrosProduto(filtrosProdutoInicial);
    setOrdenacaoProdutos({ campo: 'nome', direcao: 'asc' });
  }

  const movimentacoesVisiveis = mostrarMovimentacoesAntigas
    ? movimentacoes
    : movimentacoes.slice(0, LIMITE_MOVIMENTACOES_VISIVEIS);

  const totalMovimentacoesOcultas = Math.max(
    movimentacoes.length - LIMITE_MOVIMENTACOES_VISIVEIS,
    0
  );

  const resumoMovimentacoes = useMemo(() => {
    const periodo = PERIODOS_RESUMO[periodoResumo];
    const inicio = new Date();
    inicio.setHours(0, 0, 0, 0);
    inicio.setDate(inicio.getDate() - (periodo.dias - 1));

    const itens = movimentacoes.filter((item) => new Date(item.createdAt) >= inicio);

    const porTipo = itens.reduce(
      (total, item) => {
        total[item.tipo] = (total[item.tipo] || 0) + Number(item.quantidade || 0);
        return total;
      },
      { entrada: 0, saida: 0, ajuste: 0 }
    );

    const porProduto = itens.reduce((total, item) => {
      const nome = item.produto?.nome || 'Produto removido';

      if (!total[nome]) {
        total[nome] = { produto: nome, entrada: 0, saida: 0, ajuste: 0, total: 0 };
      }

      total[nome][item.tipo] += Number(item.quantidade || 0);
      total[nome].total += Number(item.quantidade || 0);
      return total;
    }, {});

    return {
      inicio,
      itens,
      porTipo,
      porProduto: Object.values(porProduto).sort((a, b) => b.total - a.total)
    };
  }, [movimentacoes, periodoResumo]);

  async function executarAcao(acao, sucesso) {
    setSalvando(true);
    setErro('');
    setMensagem('');

    try {
      await acao();
      setMensagem(sucesso);
      await carregarDados();
    } catch (error) {
      setErro(error.message);
    } finally {
      setSalvando(false);
    }
  }

  function atualizarProduto(campo, valor) {
    setProduto((atual) => ({ ...atual, [campo]: valor }));
  }

  async function salvarProduto(event) {
    event.preventDefault();
    await executarAcao(
      () =>
        api.criarProduto({
          ...produto,
          quantidadeAtual: Number(produto.quantidadeAtual),
          estoqueMinimo: Number(produto.estoqueMinimo),
          precoUnitario: Number(produto.precoUnitario)
        }),
      'Produto cadastrado com sucesso.'
    );
    setProduto(produtoInicial);
  }

  async function salvarCategoria(event) {
    event.preventDefault();
    await executarAcao(() => api.criarCategoria(categoria), 'Categoria cadastrada com sucesso.');
    setCategoria(categoriaInicial);
  }

  async function salvarFornecedor(event) {
    event.preventDefault();
    await executarAcao(
      () => api.criarFornecedor(fornecedor),
      'Fornecedor cadastrado com sucesso.'
    );
    setFornecedor(fornecedorInicial);
  }

  async function salvarMovimentacao(event) {
    event.preventDefault();
    await executarAcao(
      () =>
        api.criarMovimentacao({
          ...movimentacao,
          quantidade: Number(movimentacao.quantidade)
        }),
      'Movimentacao registrada com sucesso.'
    );
    setMovimentacao(movimentacaoInicial);
  }

  async function removerProduto(item) {
    const confirmou = window.confirm(`Remover "${item.nome}" do estoque?`);

    if (!confirmou) {
      return;
    }

    await executarAcao(() => api.removerProduto(item._id), 'Produto removido do estoque.');
  }

  function iniciarEdicaoPreco(item) {
    setPrecoEmEdicao({
      id: item._id,
      valor: String(item.precoUnitario ?? 0)
    });
  }

  async function salvarPreco(item) {
    if (!precoEmEdicao || precoEmEdicao.id !== item._id) {
      return;
    }

    const novoPreco = Number(String(precoEmEdicao.valor).replace(',', '.'));

    if (Number.isNaN(novoPreco) || novoPreco < 0) {
      setErro('Informe um valor unitario valido.');
      return;
    }

    setPrecoEmEdicao(null);

    await executarAcao(
      () =>
        api.atualizarProduto(item._id, {
          nome: item.nome,
          categoria: item.categoria?._id || item.categoria,
          fornecedor: item.fornecedor?._id || item.fornecedor,
          quantidadeAtual: item.quantidadeAtual,
          unidadeMedida: item.unidadeMedida,
          estoqueMinimo: item.estoqueMinimo,
          precoUnitario: novoPreco,
          ativo: item.ativo
        }),
      'Valor unitario atualizado.'
    );
  }

  function lidarTeclaPreco(event, item) {
    if (event.key === 'Enter') {
      event.preventDefault();
      salvarPreco(item);
    }

    if (event.key === 'Escape') {
      setPrecoEmEdicao(null);
    }
  }

  function abrirEdicaoProduto(item) {
    if (!admin) {
      return;
    }

    setProdutoEditando(item);
    setProdutoEdicao({
      nome: item.nome || '',
      categoria: item.categoria?._id || item.categoria || '',
      fornecedor: item.fornecedor?._id || item.fornecedor || '',
      quantidadeAtual: String(item.quantidadeAtual ?? 0),
      unidadeMedida: item.unidadeMedida || 'un',
      estoqueMinimo: String(item.estoqueMinimo ?? 0),
      precoUnitario: String(item.precoUnitario ?? 0),
      ativo: item.ativo
    });
  }

  function fecharEdicaoProduto() {
    setProdutoEditando(null);
    setProdutoEdicao(null);
  }

  async function salvarProdutoEditado(event) {
    event.preventDefault();

    if (!produtoEditando || !produtoEdicao) {
      return;
    }

    setSalvando(true);
    setErro('');
    setMensagem('');

    try {
      await api.atualizarProduto(produtoEditando._id, {
        ...produtoEdicao,
        quantidadeAtual: Number(produtoEdicao.quantidadeAtual),
        estoqueMinimo: Number(produtoEdicao.estoqueMinimo),
        precoUnitario: Number(String(produtoEdicao.precoUnitario).replace(',', '.'))
      });
      setMensagem('Produto atualizado.');
      await carregarDados();
      fecharEdicaoProduto();
    } catch (error) {
      setErro(error.message);
    } finally {
      setSalvando(false);
    }
  }

  if (authCarregando) {
    return (
      <main className="auth-shell">
        <section className="auth-card">
          <ShieldCheck size={28} />
          <h1>Carregando acesso</h1>
          <p>Conferindo a sessao do sistema.</p>
        </section>
      </main>
    );
  }

  if (!usuarioLogado) {
    return (
      <main className="auth-shell">
        <section className="auth-card">
          <div className="auth-header">
            <ShieldCheck size={30} />
            <div>
              <span className="eyebrow">Acesso seguro</span>
              <h1>{setupNecessario ? 'Criar administrador' : 'Entrar no estoque'}</h1>
            </div>
          </div>

          {erro && <div className="notice notice-error">{erro}</div>}
          {mensagem && <div className="notice notice-success">{mensagem}</div>}

          <form className="form" onSubmit={autenticar}>
            {setupNecessario && (
              <label>
                Nome do administrador
                <input
                  required
                  value={loginForm.nome}
                  onChange={(event) => setLoginForm({ ...loginForm, nome: event.target.value })}
                  placeholder="Ex.: Administrador"
                />
              </label>
            )}
            <label>
              Email
              <input
                required
                type="email"
                value={loginForm.email}
                onChange={(event) => setLoginForm({ ...loginForm, email: event.target.value })}
                placeholder="admin@email.com"
              />
            </label>
            <label>
              Senha
              <input
                required
                minLength={6}
                type="password"
                value={loginForm.senha}
                onChange={(event) => setLoginForm({ ...loginForm, senha: event.target.value })}
                placeholder="Minimo 6 caracteres"
              />
            </label>
            <button className="primary-button" disabled={salvando} type="submit">
              <ShieldCheck size={17} />
              {setupNecessario ? 'Criar admin' : 'Entrar'}
            </button>
          </form>
        </section>
      </main>
    );
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <span className="eyebrow">Lanchonete</span>
          <h1>Gestao de Estoque</h1>
        </div>
        <div className="topbar-actions">
          <div className="user-badge">
            <ShieldCheck size={16} />
            <span>{usuarioLogado.nome}</span>
            <strong>{usuarioLogado.papel === 'admin' ? 'Admin' : 'Operador'}</strong>
          </div>
          <button
            className="theme-switch"
            onClick={() => setTema((atual) => (atual === 'claro' ? 'escuro' : 'claro'))}
            title={tema === 'claro' ? 'Usar tema escuro' : 'Usar tema claro'}
            type="button"
          >
            {tema === 'claro' ? <Moon size={17} /> : <Sun size={17} />}
            <span>{tema === 'claro' ? 'Escuro' : 'Claro'}</span>
          </button>
          <button className="icon-button" onClick={carregarDados} title="Atualizar dados" type="button">
            <RefreshCw size={18} />
          </button>
          <button className="icon-button" onClick={sair} title="Sair" type="button">
            <LogOut size={18} />
          </button>
        </div>
      </header>

      {erro && <div className="notice notice-error">{erro}</div>}
      {mensagem && <div className="notice notice-success">{mensagem}</div>}

      <section className="metrics-grid">
        <MetricCard label="Produtos ativos" value={dashboard?.totais?.produtos ?? '-'} />
        <MetricCard
          label="Itens em alerta"
          value={dashboard?.totais?.produtosEmAlerta ?? '-'}
          tone="warning"
        />
        <MetricCard
          label="Unidades no estoque"
          value={numero(dashboard?.totais?.itensEmEstoque)}
          tone="stock"
        />
        <MetricCard
          label="Valor estimado"
          value={moeda(dashboard?.totais?.valorEstoque)}
          tone="money"
        />
      </section>

      <section className="work-grid">
        <div className="panel panel-wide">
          <div className="panel-header inventory-header">
            <div>
              <span className="eyebrow">Inventario</span>
              <h2>Produtos</h2>
            </div>
            <div className="product-filters">
              <label className="search-box">
                <Search size={17} />
                <input
                  value={busca}
                  onChange={(event) => setBusca(event.target.value)}
                  placeholder="Buscar produto, categoria ou fornecedor"
                />
              </label>
              <select
                aria-label="Filtrar por categoria"
                value={filtrosProduto.categoria}
                onChange={(event) =>
                  setFiltrosProduto((atual) => ({ ...atual, categoria: event.target.value }))
                }
              >
                <option value="">Todas as categorias</option>
                {categorias.map((item) => (
                  <option key={item._id} value={item._id}>
                    {item.nome}
                  </option>
                ))}
              </select>
              <select
                aria-label="Filtrar por fornecedor"
                value={filtrosProduto.fornecedor}
                onChange={(event) =>
                  setFiltrosProduto((atual) => ({ ...atual, fornecedor: event.target.value }))
                }
              >
                <option value="">Todos os fornecedores</option>
                {fornecedores.map((item) => (
                  <option key={item._id} value={item._id}>
                    {item.nome}
                  </option>
                ))}
              </select>
              <select
                aria-label="Filtrar por status"
                value={filtrosProduto.status}
                onChange={(event) =>
                  setFiltrosProduto((atual) => ({ ...atual, status: event.target.value }))
                }
              >
                <option value="">Todos os status</option>
                <option value="ok">Estoque OK</option>
                <option value="alerta">Em alerta</option>
              </select>
              <button className="secondary-button filter-clear" onClick={limparFiltrosProduto} type="button">
                Limpar
              </button>
            </div>
          </div>

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th><button className="sort-button" onClick={() => alternarOrdenacao('nome')} type="button">Produto <span>{indicadorOrdenacao('nome')}</span></button></th>
                  <th><button className="sort-button" onClick={() => alternarOrdenacao('categoria')} type="button">Categoria <span>{indicadorOrdenacao('categoria')}</span></button></th>
                  <th><button className="sort-button" onClick={() => alternarOrdenacao('fornecedor')} type="button">Fornecedor <span>{indicadorOrdenacao('fornecedor')}</span></button></th>
                  <th><button className="sort-button" onClick={() => alternarOrdenacao('quantidadeAtual')} type="button">Qtd. <span>{indicadorOrdenacao('quantidadeAtual')}</span></button></th>
                  <th><button className="sort-button" onClick={() => alternarOrdenacao('estoqueMinimo')} type="button">Min. <span>{indicadorOrdenacao('estoqueMinimo')}</span></button></th>
                  <th><button className="sort-button" onClick={() => alternarOrdenacao('precoUnitario')} type="button">Valor <span>{indicadorOrdenacao('precoUnitario')}</span></button></th>
                  <th><button className="sort-button" onClick={() => alternarOrdenacao('status')} type="button">Status <span>{indicadorOrdenacao('status')}</span></button></th>
                  {admin && <th>Acoes</th>}
                </tr>
              </thead>
              <tbody>
                {produtosFiltrados.map((item) => (
                  <tr className={admin ? "clickable-row" : undefined} key={item._id} onClick={() => abrirEdicaoProduto(item)}>
                    <td>
                      <strong>{item.nome}</strong>
                      <span>{item.unidadeMedida}</span>
                    </td>
                    <td>{item.categoria?.nome || '-'}</td>
                    <td>{item.fornecedor?.nome || '-'}</td>
                    <td>{numero(item.quantidadeAtual)}</td>
                    <td>{numero(item.estoqueMinimo)}</td>
                    <td>{moeda(item.precoUnitario)}</td>
                    <td>
                      <span className={`status ${item.emAlerta ? 'danger' : 'ok'}`}>
                        {item.emAlerta ? <AlertTriangle size={15} /> : <CheckCircle2 size={15} />}
                        {item.emAlerta ? 'Alerta' : 'OK'}
                      </span>
                    </td>
                    {admin && (
                      <td>
                        <button
                          className="table-action danger"
                          onClick={(event) => { event.stopPropagation(); removerProduto(item); }}
                          title="Remover produto"
                          type="button"
                        >
                          <Trash2 size={15} />
                          Remover
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {!carregando && produtosFiltrados.length === 0 && (
            <EmptyState
              title="Nenhum produto encontrado"
              text="Cadastre produtos ou ajuste a busca para ver o estoque."
            />
          )}
        </div>

        {admin && (
        <aside className="panel">
          <div className="panel-header">
            <div>
              <span className="eyebrow">Cadastro</span>
              <h2>Adicionar dados</h2>
            </div>
          </div>

          <div className="tabs">
            <button className={aba === 'produto' ? 'active' : ''} onClick={() => setAba('produto')}>
              <Boxes size={16} />
              Produto
            </button>
            <button
              className={aba === 'categoria' ? 'active' : ''}
              onClick={() => setAba('categoria')}
            >
              <SlidersHorizontal size={16} />
              Categoria
            </button>
            <button
              className={aba === 'fornecedor' ? 'active' : ''}
              onClick={() => setAba('fornecedor')}
            >
              <Truck size={16} />
              Fornecedor
            </button>
          </div>

          {aba === 'produto' && (
            <form className="form" onSubmit={salvarProduto}>
              <label>
                Nome
                <input
                  required
                  value={produto.nome}
                  onChange={(event) => atualizarProduto('nome', event.target.value)}
                  placeholder="Ex.: Hamburguer bovino"
                />
              </label>
              <div className="form-row">
                <label>
                  Categoria
                  <select
                    required
                    value={produto.categoria}
                    onChange={(event) => atualizarProduto('categoria', event.target.value)}
                  >
                    <option value="">Selecione</option>
                    {categorias.map((item) => (
                      <option key={item._id} value={item._id}>
                        {item.nome}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Fornecedor
                  <select
                    required
                    value={produto.fornecedor}
                    onChange={(event) => atualizarProduto('fornecedor', event.target.value)}
                  >
                    <option value="">Selecione</option>
                    {fornecedores.map((item) => (
                      <option key={item._id} value={item._id}>
                        {item.nome}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="form-row">
                <label>
                  Quantidade
                  <input
                    min="0"
                    required
                    type="number"
                    value={produto.quantidadeAtual}
                    onChange={(event) => atualizarProduto('quantidadeAtual', event.target.value)}
                  />
                </label>
                <label>
                  Unidade
                  <input
                    required
                    value={produto.unidadeMedida}
                    onChange={(event) => atualizarProduto('unidadeMedida', event.target.value)}
                  />
                </label>
              </div>
              <div className="form-row">
                <label>
                  Estoque minimo
                  <input
                    min="0"
                    required
                    type="number"
                    value={produto.estoqueMinimo}
                    onChange={(event) => atualizarProduto('estoqueMinimo', event.target.value)}
                  />
                </label>
                <label>
                  Preco unitario
                  <input
                    min="0"
                    required
                    step="0.01"
                    type="number"
                    value={produto.precoUnitario}
                    onChange={(event) => atualizarProduto('precoUnitario', event.target.value)}
                  />
                </label>
              </div>
              <button className="primary-button" disabled={salvando}>
                <Save size={17} />
                Salvar produto
              </button>
            </form>
          )}

          {aba === 'categoria' && (
            <form className="form" onSubmit={salvarCategoria}>
              <label>
                Nome
                <input
                  required
                  value={categoria.nome}
                  onChange={(event) => setCategoria({ ...categoria, nome: event.target.value })}
                  placeholder="Ex.: Bebidas"
                />
              </label>
              <label>
                Descricao
                <textarea
                  value={categoria.descricao}
                  onChange={(event) =>
                    setCategoria({ ...categoria, descricao: event.target.value })
                  }
                  placeholder="Itens refrigerados, insumos de chapa..."
                />
              </label>
              <button className="primary-button" disabled={salvando}>
                <Save size={17} />
                Salvar categoria
              </button>
            </form>
          )}

          {aba === 'fornecedor' && (
            <form className="form" onSubmit={salvarFornecedor}>
              <label>
                Nome
                <input
                  required
                  value={fornecedor.nome}
                  onChange={(event) => setFornecedor({ ...fornecedor, nome: event.target.value })}
                  placeholder="Ex.: Distribuidora Central"
                />
              </label>
              <div className="form-row">
                <label>
                  CNPJ
                  <input
                    value={fornecedor.cnpj}
                    onChange={(event) =>
                      setFornecedor({ ...fornecedor, cnpj: event.target.value })
                    }
                  />
                </label>
                <label>
                  Telefone
                  <input
                    value={fornecedor.telefone}
                    onChange={(event) =>
                      setFornecedor({ ...fornecedor, telefone: event.target.value })
                    }
                  />
                </label>
              </div>
              <label>
                Email
                <input
                  type="email"
                  value={fornecedor.email}
                  onChange={(event) => setFornecedor({ ...fornecedor, email: event.target.value })}
                />
              </label>
              <label>
                Endereco
                <input
                  value={fornecedor.endereco}
                  onChange={(event) =>
                    setFornecedor({ ...fornecedor, endereco: event.target.value })
                  }
                />
              </label>
              <button className="primary-button" disabled={salvando}>
                <Save size={17} />
                Salvar fornecedor
              </button>
            </form>
          )}
        </aside>
        )}
      </section>

      <section className="panel supplier-panel">
        <div className="panel-header">
          <div>
            <span className="eyebrow">Parceiros</span>
            <h2>Fornecedores</h2>
          </div>
          <Truck size={20} />
        </div>

        <div className="table-wrap">
          <table className="compact-table">
            <thead>
              <tr>
                <th>Fornecedor</th>
                <th>Telefone</th>
                <th>Email</th>
                <th>CNPJ</th>
              </tr>
            </thead>
            <tbody>
              {fornecedores.map((item) => (
                <tr
                  className="clickable-row"
                  key={item._id}
                  onClick={() => setFornecedorSelecionado(item)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      setFornecedorSelecionado(item);
                    }
                  }}
                  role="button"
                  tabIndex={0}
                >
                  <td>
                    <strong>{item.nome}</strong>
                    <span>{item.endereco || 'Sem endereco'}</span>
                  </td>
                  <td>{item.telefone || '-'}</td>
                  <td>{item.email || '-'}</td>
                  <td>{item.cnpj || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {!carregando && fornecedores.length === 0 && (
          <EmptyState
            title="Nenhum fornecedor cadastrado"
            text="Cadastre fornecedores para consulta-los nesta tabela."
          />
        )}
      </section>

      {admin && (
        <section className="panel users-panel">
          <div className="panel-header">
            <div>
              <span className="eyebrow">Administracao</span>
              <h2>Usuarios do sistema</h2>
            </div>
            <Users size={20} />
          </div>

          <div className="users-grid">
            <form className="form" onSubmit={salvarUsuario}>
              <div className="form-row">
                <label>
                  Nome
                  <input
                    required
                    value={usuarioForm.nome}
                    onChange={(event) => setUsuarioForm({ ...usuarioForm, nome: event.target.value })}
                  />
                </label>
                <label>
                  Email
                  <input
                    required
                    type="email"
                    value={usuarioForm.email}
                    onChange={(event) => setUsuarioForm({ ...usuarioForm, email: event.target.value })}
                  />
                </label>
              </div>
              <div className="form-row">
                <label>
                  Perfil
                  <select
                    value={usuarioForm.papel}
                    onChange={(event) => setUsuarioForm({ ...usuarioForm, papel: event.target.value })}
                  >
                    <option value="operador">Operador</option>
                    <option value="admin">Admin</option>
                  </select>
                </label>
                <label>
                  Senha {usuarioEditando ? 'nova' : ''}
                  <input
                    required={!usuarioEditando}
                    minLength={6}
                    type="password"
                    value={usuarioForm.senha}
                    onChange={(event) => setUsuarioForm({ ...usuarioForm, senha: event.target.value })}
                    placeholder={usuarioEditando ? 'Deixe em branco para manter' : 'Minimo 6 caracteres'}
                  />
                </label>
              </div>
              {usuarioEditando && (
                <>
                  <label className="checkbox-row">
                    <input
                      checked={usuarioForm.ativo}
                      onChange={(event) =>
                        setUsuarioForm({ ...usuarioForm, ativo: event.target.checked })
                      }
                      type="checkbox"
                    />
                    Usuario ativo
                  </label>
                  <label>
                    Sua senha de admin
                    <input
                      required
                      type="password"
                      value={usuarioForm.senhaConfirmacao}
                      onChange={(event) =>
                        setUsuarioForm({ ...usuarioForm, senhaConfirmacao: event.target.value })
                      }
                      placeholder="Obrigatoria para alterar login"
                    />
                  </label>
                </>
              )}
              <div className="form-actions">
                <button className="primary-button" disabled={salvando} type="submit">
                  <UserPlus size={17} />
                  {usuarioEditando ? 'Salvar usuario' : 'Cadastrar usuario'}
                </button>
                {usuarioEditando && (
                  <button className="secondary-button" onClick={cancelarEdicaoUsuario} type="button">
                    Cancelar
                  </button>
                )}
              </div>
            </form>

            <div className="table-wrap users-table-wrap">
              <table className="compact-table">
                <thead>
                  <tr>
                    <th>Usuario</th>
                    <th>Perfil</th>
                    <th>Status</th>
                    <th>Acoes</th>
                  </tr>
                </thead>
                <tbody>
                  {usuarios.map((item) => (
                    <tr key={item._id}>
                      <td>
                        <strong>{item.nome}</strong>
                        <span>{item.email}</span>
                      </td>
                      <td>{item.papel === 'admin' ? 'Admin' : 'Operador'}</td>
                      <td>
                        <span className={`status ${item.ativo ? 'ok' : 'danger'}`}>
                          {item.ativo ? 'Ativo' : 'Inativo'}
                        </span>
                      </td>
                      <td>
                        <button className="table-action" onClick={() => editarUsuario(item)} type="button">
                          Editar
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}

      <section className="bottom-grid">
        <div className="panel">
          <div className="panel-header">
            <div>
              <span className="eyebrow">Operacao</span>
              <h2>Movimentar estoque</h2>
            </div>
            <PackagePlus size={20} />
          </div>

          <form className="form" onSubmit={salvarMovimentacao}>
            <label>
              Produto
              <select
                required
                value={movimentacao.produto}
                onChange={(event) =>
                  setMovimentacao({ ...movimentacao, produto: event.target.value })
                }
              >
                <option value="">Selecione</option>
                {produtos.map((item) => (
                  <option key={item._id} value={item._id}>
                    {item.nome} - {numero(item.quantidadeAtual)} {item.unidadeMedida}
                  </option>
                ))}
              </select>
            </label>
            <div className="movement-options">
              {[
                ['entrada', ArrowUp, 'Entrada'],
                ['saida', ArrowDown, 'Saida'],
                ['ajuste', SlidersHorizontal, 'Ajuste']
              ].map(([tipo, Icone, label]) => (
                <button
                  className={movimentacao.tipo === tipo ? 'active' : ''}
                  key={tipo}
                  onClick={() => setMovimentacao({ ...movimentacao, tipo })}
                  type="button"
                >
                  <Icone size={16} />
                  {label}
                </button>
              ))}
            </div>
            <div className="form-row">
              <label>
                Quantidade
                <input
                  min="1"
                  required
                  type="number"
                  value={movimentacao.quantidade}
                  onChange={(event) =>
                    setMovimentacao({ ...movimentacao, quantidade: event.target.value })
                  }
                />
              </label>
              <label>
                Usuario
                <input
                  required
                  value={movimentacao.usuario}
                  onChange={(event) =>
                    setMovimentacao({ ...movimentacao, usuario: event.target.value })
                  }
                />
              </label>
            </div>
            <label>
              Observacao
              <textarea
                value={movimentacao.observacao}
                onChange={(event) =>
                  setMovimentacao({ ...movimentacao, observacao: event.target.value })
                }
                placeholder="Compra, perda, contagem manual..."
              />
            </label>
            <button className="primary-button" disabled={salvando}>
              <Save size={17} />
              Registrar movimentacao
            </button>
          </form>
        </div>

        <div className="panel">
          <div className="panel-header">
            <div>
              <span className="eyebrow">Historico</span>
              <h2>Ultimas movimentacoes</h2>
            </div>
            <button className="secondary-button summary-button" onClick={() => setResumoAberto(true)} type="button">
              Resumo
            </button>
          </div>

          <div className="timeline">
            {movimentacoesVisiveis.map((item) => (
              <button
                key={item._id}
                className="timeline-item"
                onClick={() => setMovimentacaoSelecionada(item)}
                type="button"
              >
                <span className={`movement-dot ${item.tipo}`} />
                <div>
                  <strong>{item.produto?.nome || 'Produto removido'}</strong>
                  <p>
                    {item.tipo} de {numero(item.quantidade)} unidade(s)
                  </p>
                  <small>
                    {dataCurta(item.createdAt)} por {item.usuario}
                  </small>
                </div>
              </button>
            ))}
          </div>

          {totalMovimentacoesOcultas > 0 && (
            <button
              className="secondary-button history-toggle"
              onClick={() => setMostrarMovimentacoesAntigas((atual) => !atual)}
              type="button"
            >
              {mostrarMovimentacoesAntigas
                ? 'Mostrar apenas recentes'
                : `Mostrar ${totalMovimentacoesOcultas} movimentacao(oes) antiga(s)`}
            </button>
          )}

          {!carregando && movimentacoes.length === 0 && (
            <EmptyState
              title="Sem movimentacoes"
              text="As entradas, saidas e ajustes vao aparecer aqui."
            />
          )}
        </div>
      </section>

      {produtoEditando && produtoEdicao && (
        <div className="modal-backdrop" onClick={fecharEdicaoProduto} role="presentation">
          <section
            aria-labelledby="produto-edicao-titulo"
            aria-modal="true"
            className="modal-card product-edit-modal"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
          >
            <div className="modal-header">
              <div>
                <span className="eyebrow">Confirmar alteracao</span>
                <h2 id="produto-edicao-titulo">Editar produto</h2>
              </div>
              <button
                className="icon-button modal-close"
                onClick={fecharEdicaoProduto}
                title="Fechar"
                type="button"
              >
                <X size={18} />
              </button>
            </div>

            <form className="form" onSubmit={salvarProdutoEditado}>
              <label>
                Nome
                <input
                  required
                  value={produtoEdicao.nome}
                  onChange={(event) =>
                    setProdutoEdicao((atual) => ({ ...atual, nome: event.target.value }))
                  }
                />
              </label>
              <div className="form-row">
                <label>
                  Categoria
                  <select
                    required
                    value={produtoEdicao.categoria}
                    onChange={(event) =>
                      setProdutoEdicao((atual) => ({ ...atual, categoria: event.target.value }))
                    }
                  >
                    <option value="">Selecione</option>
                    {categorias.map((item) => (
                      <option key={item._id} value={item._id}>
                        {item.nome}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Fornecedor
                  <select
                    required
                    value={produtoEdicao.fornecedor}
                    onChange={(event) =>
                      setProdutoEdicao((atual) => ({ ...atual, fornecedor: event.target.value }))
                    }
                  >
                    <option value="">Selecione</option>
                    {fornecedores.map((item) => (
                      <option key={item._id} value={item._id}>
                        {item.nome}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="form-row">
                <label>
                  Quantidade
                  <input
                    min="0"
                    required
                    type="number"
                    value={produtoEdicao.quantidadeAtual}
                    onChange={(event) =>
                      setProdutoEdicao((atual) => ({ ...atual, quantidadeAtual: event.target.value }))
                    }
                  />
                </label>
                <label>
                  Estoque minimo
                  <input
                    min="0"
                    required
                    type="number"
                    value={produtoEdicao.estoqueMinimo}
                    onChange={(event) =>
                      setProdutoEdicao((atual) => ({ ...atual, estoqueMinimo: event.target.value }))
                    }
                  />
                </label>
              </div>
              <div className="form-row">
                <label>
                  Unidade
                  <input
                    required
                    value={produtoEdicao.unidadeMedida}
                    onChange={(event) =>
                      setProdutoEdicao((atual) => ({ ...atual, unidadeMedida: event.target.value }))
                    }
                  />
                </label>
                <label>
                  Preco unitario
                  <input
                    min="0"
                    required
                    step="0.01"
                    type="number"
                    value={produtoEdicao.precoUnitario}
                    onChange={(event) =>
                      setProdutoEdicao((atual) => ({ ...atual, precoUnitario: event.target.value }))
                    }
                  />
                </label>
              </div>
              <p className="confirm-note">
                Revise as alteracoes antes de confirmar. A atualizacao sera aplicada ao estoque.
              </p>
              <div className="form-actions">
                <button className="primary-button" disabled={salvando} type="submit">
                  <Save size={17} />
                  Confirmar alteracao
                </button>
                <button className="secondary-button" onClick={fecharEdicaoProduto} type="button">
                  Cancelar
                </button>
              </div>
            </form>
          </section>
        </div>
      )}

      {movimentacaoSelecionada && (
        <div
          className="modal-backdrop"
          onClick={() => setMovimentacaoSelecionada(null)}
          role="presentation"
        >
          <section
            aria-labelledby="movimentacao-titulo"
            className="modal-card"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <div className="modal-header">
              <div>
                <span className="eyebrow">Movimentacao</span>
                <h2 id="movimentacao-titulo">
                  {movimentacaoSelecionada.produto?.nome || 'Produto removido'}
                </h2>
              </div>
              <button
                className="icon-button modal-close"
                onClick={() => setMovimentacaoSelecionada(null)}
                title="Fechar"
                type="button"
              >
                <X size={18} />
              </button>
            </div>

            <div className="detail-grid">
              <div>
                <span>Tipo</span>
                <strong className="capitalize">{movimentacaoSelecionada.tipo}</strong>
              </div>
              <div>
                <span>Quantidade</span>
                <strong>{numero(movimentacaoSelecionada.quantidade)}</strong>
              </div>
              <div>
                <span>Usuario</span>
                <strong>{movimentacaoSelecionada.usuario || '-'}</strong>
              </div>
              <div>
                <span>Data</span>
                <strong>{dataCurta(movimentacaoSelecionada.createdAt)}</strong>
              </div>
              <div>
                <span>Categoria</span>
                <strong>{movimentacaoSelecionada.produto?.categoria?.nome || '-'}</strong>
              </div>
              <div>
                <span>Fornecedor</span>
                <strong>{movimentacaoSelecionada.produto?.fornecedor?.nome || '-'}</strong>
              </div>
            </div>

            <div className="detail-note">
              <span>Observacao</span>
              <p>{movimentacaoSelecionada.observacao || 'Sem observacao registrada.'}</p>
            </div>
          </section>
        </div>
      )}

      {fornecedorSelecionado && (
        <div
          className="modal-backdrop"
          onClick={() => setFornecedorSelecionado(null)}
          role="presentation"
        >
          <section
            aria-labelledby="fornecedor-titulo"
            aria-modal="true"
            className="modal-card"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
          >
            <div className="modal-header">
              <div>
                <span className="eyebrow">Fornecedor</span>
                <h2 id="fornecedor-titulo">{fornecedorSelecionado.nome}</h2>
              </div>
              <button
                className="icon-button modal-close"
                onClick={() => setFornecedorSelecionado(null)}
                title="Fechar"
                type="button"
              >
                <X size={18} />
              </button>
            </div>

            <div className="detail-grid">
              <div>
                <span>Nome</span>
                <strong>{fornecedorSelecionado.nome || '-'}</strong>
              </div>
              <div>
                <span>CNPJ</span>
                <strong>{fornecedorSelecionado.cnpj || '-'}</strong>
              </div>
              <div>
                <span>Telefone</span>
                <strong>{fornecedorSelecionado.telefone || '-'}</strong>
              </div>
              <div>
                <span>Email</span>
                <strong>{fornecedorSelecionado.email || '-'}</strong>
              </div>
              <div>
                <span>Cadastrado em</span>
                <strong>
                  {fornecedorSelecionado.createdAt ? dataCurta(fornecedorSelecionado.createdAt) : '-'}
                </strong>
              </div>
              <div>
                <span>Atualizado em</span>
                <strong>
                  {fornecedorSelecionado.updatedAt ? dataCurta(fornecedorSelecionado.updatedAt) : '-'}
                </strong>
              </div>
            </div>

            <div className="detail-note">
              <span>Endereco</span>
              <p>{fornecedorSelecionado.endereco || 'Sem endereco registrado.'}</p>
            </div>
          </section>
        </div>
      )}

      {resumoAberto && (
        <div className="modal-backdrop" onClick={() => setResumoAberto(false)} role="presentation">
          <section
            aria-labelledby="resumo-titulo"
            aria-modal="true"
            className="modal-card summary-modal"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
          >
            <div className="modal-header">
              <div>
                <span className="eyebrow">Resumo</span>
                <h2 id="resumo-titulo">Movimentacoes por periodo</h2>
              </div>
              <button
                className="icon-button modal-close"
                onClick={() => setResumoAberto(false)}
                title="Fechar"
                type="button"
              >
                <X size={18} />
              </button>
            </div>

            <div className="period-tabs">
              {Object.entries(PERIODOS_RESUMO).map(([valor, periodo]) => (
                <button
                  className={periodoResumo === valor ? 'active' : ''}
                  key={valor}
                  onClick={() => setPeriodoResumo(valor)}
                  type="button"
                >
                  {periodo.label}
                </button>
              ))}
            </div>

            <div className="detail-grid summary-grid">
              <div>
                <span>Registros</span>
                <strong>{numero(resumoMovimentacoes.itens.length)}</strong>
              </div>
              <div>
                <span>Entradas</span>
                <strong>{numero(resumoMovimentacoes.porTipo.entrada)}</strong>
              </div>
              <div>
                <span>Saidas</span>
                <strong>{numero(resumoMovimentacoes.porTipo.saida)}</strong>
              </div>
              <div>
                <span>Ajustes</span>
                <strong>{numero(resumoMovimentacoes.porTipo.ajuste)}</strong>
              </div>
            </div>

            <div className="summary-list">
              <span className="summary-list-title">Produtos movimentados</span>
              {resumoMovimentacoes.porProduto.length > 0 ? (
                resumoMovimentacoes.porProduto.map((item) => (
                  <article className="summary-row" key={item.produto}>
                    <strong>{item.produto}</strong>
                    <div>
                      <span>Entrada: {numero(item.entrada)}</span>
                      <span>Saida: {numero(item.saida)}</span>
                      <span>Ajuste: {numero(item.ajuste)}</span>
                    </div>
                  </article>
                ))
              ) : (
                <p className="summary-empty">Nenhuma movimentacao nesse periodo.</p>
              )}
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
