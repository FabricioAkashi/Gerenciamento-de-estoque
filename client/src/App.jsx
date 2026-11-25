import {
  AlertTriangle,
  ArrowDown,
  ArrowLeftRight,
  ArrowUp,
  Boxes,
  CheckCircle2,
  Eye,
  Filter,
  LogOut,
  Minus,
  Moon,
  PanelRightClose,
  Pencil,
  Plus,
  RefreshCw,
  SlidersHorizontal,
  Sun,
  Trash2,
  Truck,
  X
} from 'lucide-react';
import { AnimatePresence, motion, MotionConfig } from 'motion/react';
import React from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ContextMenu } from './components/arc/context-menu/context-menu.tsx';
import { DropdownMenu } from './components/arc/dropdown-menu/dropdown-menu.tsx';
import { ExpandingSearch } from './components/arc/expanding-search/expanding-search.tsx';
import { HoldToConfirm } from './components/arc/hold-to-confirm/hold-to-confirm.tsx';
import Toast from './components/arc/toast/toast.tsx';
import { AnalyticsPanel } from './components/AnalyticsPanel.jsx';
import { EmptyState } from './components/EmptyState.jsx';
import { MetricCard } from './components/MetricCard.jsx';
import { ModalDialog } from './components/ModalDialog.jsx';
import { api, getAuthToken, setAuthToken } from './services/api.js';
import { dataCurta, moeda, numero, rotuloTipoMovimentacao } from './utils/format.js';

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
const OPCOES_PAGINA_PRODUTOS = [10, 25, 'all'];
const TEMA_PADRAO = 'claro';
const PERIODOS_RESUMO = {
  dia: { label: '1 dia', dias: 1 },
  semana: { label: '1 semana', dias: 7 },
  mes: { label: '1 mês', dias: 30 }
};
const movimentacaoInicial = {
  produto: '',
  tipo: 'entrada',
  quantidade: 1,
  usuario: 'Operador',
  observacao: ''
};
const MOTIVOS_MOVIMENTACAO = {
  entrada: ['Compra / reposição', 'Devolução', 'Bonificação'],
  saida: ['Consumo do turno', 'Venda / balcão', 'Perda / vencimento'],
  ajuste: ['Contagem manual', 'Correção de lançamento', 'Quebra de inventário']
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
const DIAS_REMOCAO_INATIVO = 60;
const MS_POR_DIA = 24 * 60 * 60 * 1000;

function obterTextoRemocaoInativo(usuario) {
  if (!usuario || usuario.ativo) {
    return null;
  }

  const referencia = usuario.inativadoEm || usuario.updatedAt || usuario.createdAt;
  if (!referencia) {
    return `Remove após ${DIAS_REMOCAO_INATIVO} dias`;
  }

  const dataInativacao = new Date(referencia);
  if (Number.isNaN(dataInativacao.getTime())) {
    return `Remove após ${DIAS_REMOCAO_INATIVO} dias`;
  }

  const expiracaoMs = dataInativacao.getTime() + DIAS_REMOCAO_INATIVO * MS_POR_DIA;
  const diasRestantes = Math.ceil((expiracaoMs - Date.now()) / MS_POR_DIA);

  if (diasRestantes <= 0) {
    return 'Remoção hoje';
  }
  if (diasRestantes === 1) {
    return 'Remove em 1 dia';
  }
  return `Remove em ${diasRestantes}d`;
}

function temaInicial() {
  if (typeof window === 'undefined') {
    return TEMA_PADRAO;
  }

  const temaSalvo = window.localStorage.getItem('tema-estoque');
  return temaSalvo === 'escuro' ? 'escuro' : TEMA_PADRAO;
}

function painelAnaliticoInicial() {
  if (typeof window === 'undefined') {
    return true;
  }

  const salvo = window.localStorage.getItem('painel-analitico-estoque');
  if (salvo === 'aberto') return true;
  if (salvo === 'fechado') return false;
  return !window.matchMedia('(max-width: 700px)').matches;
}

function densidadeInicial() {
  if (typeof window === 'undefined') {
    return 'padrao';
  }

  return window.localStorage.getItem('densidade-tabela-produtos') === 'compacto'
    ? 'compacto'
    : 'padrao';
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
  const [painelCadastroAberto, setPainelCadastroAberto] = useState(false);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [mensagem, setMensagem] = useState('');
  const [erro, setErro] = useState('');
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
  const [carregandoUsuarios, setCarregandoUsuarios] = useState(false);
  const [usuarioForm, setUsuarioForm] = useState(usuarioInicial);
  const [usuarioEditando, setUsuarioEditando] = useState(null);
  const [itemParaRemover, setItemParaRemover] = useState(null);
  const [remocaoConfirmada, setRemocaoConfirmada] = useState(false);
  const [modalMovimentacaoAberto, setModalMovimentacaoAberto] = useState(false);
  const [isMobile, setIsMobile] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(max-width: 700px)').matches
  );
  const [painelAnaliticoAberto, setPainelAnaliticoAberto] = useState(painelAnaliticoInicial);
  const [periodoGraficos, setPeriodoGraficos] = useState(7);
  const [densidadeProdutos, setDensidadeProdutos] = useState(densidadeInicial);
  const [itensPorPaginaProdutos, setItensPorPaginaProdutos] = useState(10);
  const [paginaProdutos, setPaginaProdutos] = useState(1);
  const [filtroTipoMov, setFiltroTipoMov] = useState('');
  const [buscaMov, setBuscaMov] = useState('');
  const [filtroPerfilUsuario, setFiltroPerfilUsuario] = useState('');
  const [filtroStatusUsuario, setFiltroStatusUsuario] = useState('');
  const [toast, setToast] = useState({ open: false, tone: 'success', title: '', description: '' });
  const quantidadeMovRef = useRef(null);
  const nomeUsuarioRef = useRef(null);

  const admin = usuarioLogado?.papel === 'admin';

  const mostrarToast = useCallback((tone, title, description = '') => {
    setToast({ open: true, tone, title, description });
  }, []);

  const lidarMudancaToast = useCallback((open) => {
    setToast((atual) => ({ ...atual, open }));
  }, []);

  async function carregarDados({ notificar = false } = {}) {
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
      const textoErro =
        'A tela abriu, mas a API não respondeu. Confira se o backend está rodando e se o MongoDB Atlas autenticou corretamente.';
      setErro(textoErro);
      if (notificar) {
        mostrarToast('error', 'Falha ao atualizar', textoErro);
      }
    } else if (notificar) {
      mostrarToast('success', 'Dados atualizados', 'Estoque e movimentações sincronizados.');
    }

    setCarregando(false);
  }
  async function carregarUsuarios() {
    if (!admin) {
      return;
    }

    setCarregandoUsuarios(true);
    try {
      const lista = await api.listarUsuarios();
      setUsuarios(lista);
    } finally {
      setCarregandoUsuarios(false);
    }
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
      const textoSucesso = setupNecessario ? 'Administrador criado com sucesso.' : 'Login realizado.';
      setMensagem(textoSucesso);
      mostrarToast('success', textoSucesso);
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
    setItemParaRemover(null);
    setRemocaoConfirmada(false);
    setModalMovimentacaoAberto(false);
    setPainelCadastroAberto(false);
    setFiltroTipoMov('');
    setBuscaMov('');
    setFiltroPerfilUsuario('');
    setFiltroStatusUsuario('');
    setPaginaProdutos(1);
    setToast({ open: false, tone: 'success', title: '', description: '' });
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
        setMensagem('Usuário atualizado.');
        mostrarToast('success', 'Usuário atualizado.', `${usuarioForm.nome} teve os dados salvos.`);
      } else {
        await api.criarUsuario(usuarioForm);
        setMensagem('Usuário cadastrado.');
        mostrarToast('success', 'Usuário cadastrado.', `${usuarioForm.nome} já pode acessar o painel.`);
      }

      setUsuarioForm(usuarioInicial);
      setUsuarioEditando(null);
      await carregarUsuarios();
    } catch (error) {
      setErro(error.message);
      mostrarToast('error', 'Erro ao salvar usuário', error.message);
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
    const formulario = document.getElementById('form-usuario');
    const reduzir =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    formulario?.scrollIntoView({ behavior: reduzir ? 'auto' : 'smooth', block: 'center' });
    window.setTimeout(() => {
      nomeUsuarioRef.current?.focus();
    }, 150);
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
    if (typeof window === 'undefined' || !window.matchMedia) {
      return undefined;
    }

    const mediaQuery = window.matchMedia('(max-width: 700px)');
    const atualizarViewport = (event) => setIsMobile(event.matches);
    setIsMobile(mediaQuery.matches);
    mediaQuery.addEventListener('change', atualizarViewport);
    return () => mediaQuery.removeEventListener('change', atualizarViewport);
  }, []);

  const temFiltrosProdutoAtivos = Boolean(
    busca.trim() || filtrosProduto.categoria || filtrosProduto.fornecedor || filtrosProduto.status
  );

  useEffect(() => {
    setPaginaProdutos(1);
  }, [busca, filtrosProduto, ordenacaoProdutos, itensPorPaginaProdutos]);

  const produtosBaseStatus = useMemo(() => {
    const termo = busca.trim().toLowerCase();

    return produtos.filter((item) => {
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

      return correspondeBusca && correspondeCategoria && correspondeFornecedor;
    });
  }, [busca, filtrosProduto.categoria, filtrosProduto.fornecedor, produtos]);

  const contagensStatusProdutos = useMemo(() => {
    let alerta = 0;
    let zerado = 0;
    let ok = 0;

    for (const item of produtosBaseStatus) {
      if (Number(item.quantidadeAtual || 0) <= 0) {
        zerado += 1;
      }
      if (item.emAlerta) {
        alerta += 1;
      } else {
        ok += 1;
      }
    }

    return {
      todos: produtosBaseStatus.length,
      alerta,
      zerado,
      ok
    };
  }, [produtosBaseStatus]);

  const produtosFiltrados = useMemo(() => {
    const lista = produtosBaseStatus.filter((item) => {
      if (filtrosProduto.status === 'alerta') return Boolean(item.emAlerta);
      if (filtrosProduto.status === 'zerado') return Number(item.quantidadeAtual || 0) <= 0;
      if (filtrosProduto.status === 'ok') return !item.emAlerta;
      return true;
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
  }, [filtrosProduto.status, ordenacaoProdutos, produtosBaseStatus]);

  const totalProdutosFiltrados = produtosFiltrados.length;
  const tamanhoPaginaProdutos =
    itensPorPaginaProdutos === 'all'
      ? Math.max(totalProdutosFiltrados, 1)
      : Number(itensPorPaginaProdutos);
  const totalPaginasProdutos = Math.max(1, Math.ceil(totalProdutosFiltrados / tamanhoPaginaProdutos));
  const paginaSeguraProdutos = Math.min(paginaProdutos, totalPaginasProdutos);
  const indiceInicioProdutos = (paginaSeguraProdutos - 1) * tamanhoPaginaProdutos;
  const produtosPaginados =
    itensPorPaginaProdutos === 'all'
      ? produtosFiltrados
      : produtosFiltrados.slice(indiceInicioProdutos, indiceInicioProdutos + tamanhoPaginaProdutos);
  const inicioMostradoProdutos = totalProdutosFiltrados === 0 ? 0 : indiceInicioProdutos + 1;
  const fimMostradoProdutos = Math.min(
    indiceInicioProdutos + produtosPaginados.length,
    totalProdutosFiltrados
  );

  function alternarDensidadeProdutos(novaDensidade) {
    setDensidadeProdutos(novaDensidade);
    window.localStorage.setItem('densidade-tabela-produtos', novaDensidade);
  }

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

  function alternarPainelAnalitico() {
    setPainelAnaliticoAberto((atual) => {
      const proximo = !atual;
      window.localStorage.setItem('painel-analitico-estoque', proximo ? 'aberto' : 'fechado');
      return proximo;
    });
  }

  function alternarFiltroCategoria(categoriaId) {
    setFiltrosProduto((atual) => ({
      ...atual,
      categoria: atual.categoria === categoriaId ? '' : categoriaId
    }));
  }

  const movimentacoesBaseBusca = useMemo(() => {
    const termo = buscaMov.trim().toLowerCase();
    if (!termo) {
      return movimentacoes;
    }

    return movimentacoes.filter((item) =>
      [
        item.produto?.nome,
        item.usuario,
        item.observacao,
        rotuloTipoMovimentacao(item.tipo)
      ]
        .filter(Boolean)
        .some((valor) => valor.toLowerCase().includes(termo))
    );
  }, [buscaMov, movimentacoes]);

  const contagensTipoMov = useMemo(() => {
    const resumo = {
      todas: movimentacoesBaseBusca.length,
      entrada: 0,
      saida: 0,
      ajuste: 0
    };

    for (const item of movimentacoesBaseBusca) {
      if (item.tipo in resumo) {
        resumo[item.tipo] += 1;
      }
    }

    return resumo;
  }, [movimentacoesBaseBusca]);

  const movimentacoesFiltradas = useMemo(() => {
    if (!filtroTipoMov) {
      return movimentacoesBaseBusca;
    }

    return movimentacoesBaseBusca.filter((item) => item.tipo === filtroTipoMov);
  }, [filtroTipoMov, movimentacoesBaseBusca]);

  const temFiltrosMovAtivos = Boolean(filtroTipoMov || buscaMov.trim());

  const movimentacoesVisiveis = mostrarMovimentacoesAntigas
    ? movimentacoesFiltradas
    : movimentacoesFiltradas.slice(0, LIMITE_MOVIMENTACOES_VISIVEIS);

  const totalMovimentacoesOcultas = Math.max(
    movimentacoesFiltradas.length - LIMITE_MOVIMENTACOES_VISIVEIS,
    0
  );

  function limparFiltrosMov() {
    setFiltroTipoMov('');
    setBuscaMov('');
  }

  const movimentacoesPorUsuario = useMemo(() => {
    const mapa = new Map();
    for (const item of movimentacoes) {
      const chave = String(item.usuario || '').trim().toLowerCase();
      if (!chave) continue;
      mapa.set(chave, (mapa.get(chave) || 0) + 1);
    }
    return mapa;
  }, [movimentacoes]);

  const usuariosFiltrados = useMemo(
    () =>
      usuarios.filter((item) => {
        const correspondePerfil = filtroPerfilUsuario ? item.papel === filtroPerfilUsuario : true;
        const correspondeStatus = filtroStatusUsuario
          ? filtroStatusUsuario === 'ativo'
            ? Boolean(item.ativo)
            : !item.ativo
          : true;
        return correspondePerfil && correspondeStatus;
      }),
    [filtroPerfilUsuario, filtroStatusUsuario, usuarios]
  );

  const temFiltrosUsuarioAtivos = Boolean(filtroPerfilUsuario || filtroStatusUsuario);

  function limparFiltrosUsuarios() {
    setFiltroPerfilUsuario('');
    setFiltroStatusUsuario('');
  }

  function rolarParaSecao(id) {
    const el = document.getElementById(id);
    if (!el) return;
    const reduzir =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    el.scrollIntoView({ behavior: reduzir ? 'auto' : 'smooth', block: 'start' });
  }

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
      mostrarToast('success', sucesso);
      await carregarDados();
      return true;
    } catch (error) {
      setErro(error.message);
      mostrarToast('error', 'Não foi possível concluir', error.message);
      return false;
    } finally {
      setSalvando(false);
    }
  }

  function atualizarProduto(campo, valor) {
    setProduto((atual) => ({ ...atual, [campo]: valor }));
  }

  async function salvarProduto(event) {
    event.preventDefault();
    const ok = await executarAcao(
      () =>
        api.criarProduto({
          ...produto,
          quantidadeAtual: Number(produto.quantidadeAtual),
          estoqueMinimo: Number(produto.estoqueMinimo),
          precoUnitario: Number(produto.precoUnitario)
        }),
      'Produto cadastrado com sucesso.'
    );
    if (ok) {
      setProduto(produtoInicial);
      if (isMobile) {
        setPainelCadastroAberto(false);
      }
    }
  }

  async function salvarCategoria(event) {
    event.preventDefault();
    const ok = await executarAcao(() => api.criarCategoria(categoria), 'Categoria cadastrada com sucesso.');
    if (ok) {
      setCategoria(categoriaInicial);
      if (isMobile) {
        setPainelCadastroAberto(false);
      }
    }
  }

  async function salvarFornecedor(event) {
    event.preventDefault();
    const ok = await executarAcao(
      () => api.criarFornecedor(fornecedor),
      'Fornecedor cadastrado com sucesso.'
    );
    if (ok) {
      setFornecedor(fornecedorInicial);
      if (isMobile) {
        setPainelCadastroAberto(false);
      }
    }
  }

  const produtoMovSelecionado = useMemo(
    () => produtos.find((item) => item._id === movimentacao.produto) || null,
    [produtos, movimentacao.produto]
  );

  const qtdMovNumero = Number(movimentacao.quantidade);
  const qtdMovValida = Number.isFinite(qtdMovNumero) && qtdMovNumero > 0;
  const saldoAtualMov = Number(produtoMovSelecionado?.quantidadeAtual ?? 0);
  const novoSaldoMov = useMemo(() => {
    if (!produtoMovSelecionado) return 0;
    if (!qtdMovValida) return saldoAtualMov;
    if (movimentacao.tipo === 'entrada') return saldoAtualMov + qtdMovNumero;
    if (movimentacao.tipo === 'saida') return saldoAtualMov - qtdMovNumero;
    return qtdMovNumero;
  }, [produtoMovSelecionado, qtdMovValida, qtdMovNumero, saldoAtualMov, movimentacao.tipo]);

  const saldoInsuficienteMov = Boolean(
    produtoMovSelecionado &&
      movimentacao.tipo === 'saida' &&
      qtdMovValida &&
      qtdMovNumero > saldoAtualMov
  );

  const ficaraEmAlertaMov = Boolean(
    produtoMovSelecionado &&
      qtdMovValida &&
      !saldoInsuficienteMov &&
      novoSaldoMov <= Number(produtoMovSelecionado.estoqueMinimo ?? 0)
  );

  async function salvarMovimentacao(event) {
    event.preventDefault();

    if (!produtoMovSelecionado || !qtdMovValida || saldoInsuficienteMov || salvando) {
      return;
    }

    setSalvando(true);
    setErro('');
    setMensagem('');

    try {
      await api.criarMovimentacao({
        ...movimentacao,
        quantidade: qtdMovNumero
      });
      setModalMovimentacaoAberto(false);
      setMovimentacao(movimentacaoInicial);
      await carregarDados();
      setMensagem('Movimentação registrada com sucesso.');
      mostrarToast(
        'success',
        'Movimentação registrada',
        `${rotuloTipoMovimentacao(movimentacao.tipo)} de ${numero(qtdMovNumero)} ${produtoMovSelecionado.unidadeMedida} em ${produtoMovSelecionado.nome}.`
      );
    } catch (error) {
      setErro(error.message);
      mostrarToast('error', 'Não foi possível registrar', error.message);
    } finally {
      setSalvando(false);
    }
  }

  function solicitarRemocaoItem(tipo, item) {
    setRemocaoConfirmada(false);
    setItemParaRemover({ tipo, item });
  }

  function fecharRemocaoItem() {
    if (salvando) {
      return;
    }

    setItemParaRemover(null);
    setRemocaoConfirmada(false);
  }

  async function confirmarRemocaoItem() {
    if (!itemParaRemover || salvando) {
      return;
    }

    const alvo = itemParaRemover;
    const ehFornecedor = alvo.tipo === 'fornecedor';
    setSalvando(true);
    setErro('');
    setMensagem('');

    try {
      if (ehFornecedor) {
        await api.removerFornecedor(alvo.item._id);
      } else {
        await api.removerProduto(alvo.item._id);
      }
      setRemocaoConfirmada(true);
      await carregarDados();
      if (ehFornecedor && fornecedorSelecionado?._id === alvo.item._id) {
        setFornecedorSelecionado(null);
      }
      setItemParaRemover(null);
      setRemocaoConfirmada(false);
      setMensagem(ehFornecedor ? 'Fornecedor removido.' : 'Produto removido do estoque.');
      mostrarToast(
        'success',
        ehFornecedor ? 'Fornecedor removido' : 'Produto removido',
        ehFornecedor
          ? `"${alvo.item.nome}" foi removido da lista de fornecedores.`
          : `"${alvo.item.nome}" foi removido do estoque.`
      );
    } catch (error) {
      setRemocaoConfirmada(false);
      setErro(error.message);
      mostrarToast(
        'error',
        ehFornecedor ? 'Erro ao remover fornecedor' : 'Erro ao remover produto',
        error.message
      );
    } finally {
      setSalvando(false);
    }
  }

  function abrirModalMovimentacao(item = null) {
    setMovimentacao({
      ...movimentacaoInicial,
      produto: item?._id || '',
      tipo: 'entrada',
      quantidade: 1,
      observacao: ''
    });
    setModalMovimentacaoAberto(true);
    if (item) {
      window.setTimeout(() => {
        quantidadeMovRef.current?.focus();
      }, 120);
    }
  }

  function fecharModalMovimentacao() {
    if (salvando) {
      return;
    }

    setModalMovimentacaoAberto(false);
    setMovimentacao(movimentacaoInicial);
  }

  function selecionarTipoMovimentacao(novoTipo) {
    setMovimentacao((atual) => {
      const motivosAnteriores = MOTIVOS_MOVIMENTACAO[atual.tipo] || [];
      const observacaoEraPredefinida = motivosAnteriores.includes(atual.observacao);
      return {
        ...atual,
        tipo: novoTipo,
        observacao: observacaoEraPredefinida ? '' : atual.observacao
      };
    });
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
      mostrarToast('success', 'Produto atualizado.', `"${produtoEdicao.nome}" salvo no estoque.`);
      await carregarDados();
      fecharEdicaoProduto();
    } catch (error) {
      setErro(error.message);
      mostrarToast('error', 'Erro ao atualizar produto', error.message);
    } finally {
      setSalvando(false);
    }
  }

  const totalEmAlerta = Number(dashboard?.totais?.produtosEmAlerta || 0);
  const filtrandoAlertas = filtrosProduto.status === 'alerta';

  const produtosEmAlerta = useMemo(
    () => produtos.filter((item) => item.emAlerta),
    [produtos]
  );

  const itensBuscaProdutos = useMemo(
    () =>
      produtos.map((item) => ({
        id: item._id,
        title: item.nome,
        meta: `${numero(item.quantidadeAtual)} ${item.unidadeMedida} · ${item.categoria?.nome || 'Sem categoria'}`,
        keywords: [
          item.categoria?.nome,
          item.fornecedor?.nome,
          item.unidadeMedida,
          item.emAlerta ? 'alerta' : 'ok'
        ].filter(Boolean),
        icon: item.emAlerta ? <AlertTriangle size={15} /> : <Boxes size={15} />
      })),
    [produtos]
  );

  const sugestoesBuscaProdutos = useMemo(() => {
    const base = produtosEmAlerta.length > 0 ? produtosEmAlerta : produtos;
    return base.slice(0, 4).map((item) => ({
      id: item._id,
      title: item.nome,
      meta: `${numero(item.quantidadeAtual)} ${item.unidadeMedida} · ${item.categoria?.nome || 'Sem categoria'}`,
      icon: item.emAlerta ? <AlertTriangle size={15} /> : <Boxes size={15} />
    }));
  }, [produtosEmAlerta, produtos]);

  if (authCarregando) {
    return (
      <main className="auth-shell">
        <section className="auth-card">
          <h1>Carregando acesso</h1>
          <p>Conferindo a sessão do sistema.</p>
        </section>
      </main>
    );
  }

  if (!usuarioLogado) {
    return (
      <main className="auth-shell">
        <section className="auth-card">
          <div className="auth-header">
            <div>
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
                minLength={setupNecessario ? 8 : 1}
                type="password"
                value={loginForm.senha}
                onChange={(event) => setLoginForm({ ...loginForm, senha: event.target.value })}
                placeholder={setupNecessario ? 'Mínimo de 8 caracteres' : 'Sua senha'}
              />
            </label>
            <button className="primary-button" disabled={salvando} type="submit">
              {setupNecessario ? 'Criar admin' : 'Entrar'}
            </button>
          </form>
        </section>
      </main>
    );
  }

  const conteudoCadastro = (
    <>
      <div className={isMobile ? 'modal-header' : 'panel-header'}>
        <div>
          <h2 id={isMobile ? 'cadastro-modal-titulo' : undefined}>Novo cadastro</h2>
        </div>
        <button
          aria-label="Fechar painel de cadastro"
          className={isMobile ? 'icon-button modal-close' : 'icon-button'}
          disabled={salvando}
          onClick={() => setPainelCadastroAberto(false)}
          title="Fechar painel de cadastro"
          type="button"
        >
          <X aria-hidden="true" size={18} />
        </button>
      </div>

      <div aria-label="Tipo de cadastro" className="tabs" role="tablist">
        <button
          aria-selected={aba === 'produto'}
          className={aba === 'produto' ? 'active' : ''}
          onClick={() => setAba('produto')}
          role="tab"
          type="button"
        >
          <Boxes aria-hidden="true" size={15} />
          Produto
        </button>
        <button
          aria-selected={aba === 'categoria'}
          className={aba === 'categoria' ? 'active' : ''}
          onClick={() => setAba('categoria')}
          role="tab"
          type="button"
        >
          <SlidersHorizontal aria-hidden="true" size={15} />
          Categoria
        </button>
        <button
          aria-selected={aba === 'fornecedor'}
          className={aba === 'fornecedor' ? 'active' : ''}
          onClick={() => setAba('fornecedor')}
          role="tab"
          type="button"
        >
          <Truck aria-hidden="true" size={15} />
          Fornecedor
        </button>
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          initial={{ opacity: 0, y: 6 }}
          key={aba}
          transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
        >
          {aba === 'produto' && (
            <form className="form" onSubmit={salvarProduto}>
              <label>
                Nome
                <input
                  required
                  value={produto.nome}
                  onChange={(event) => atualizarProduto('nome', event.target.value)}
                  placeholder="Ex.: Hambúrguer bovino"
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
                  Estoque mínimo
                  <input
                    min="0"
                    required
                    type="number"
                    value={produto.estoqueMinimo}
                    onChange={(event) => atualizarProduto('estoqueMinimo', event.target.value)}
                  />
                </label>
                <label>
                  Preço unitário
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
                Descrição
                <textarea
                  value={categoria.descricao}
                  onChange={(event) =>
                    setCategoria({ ...categoria, descricao: event.target.value })
                  }
                  placeholder="Itens refrigerados, insumos de chapa..."
                />
              </label>
              <button className="primary-button" disabled={salvando}>
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
                Endereço
                <input
                  value={fornecedor.endereco}
                  onChange={(event) =>
                    setFornecedor({ ...fornecedor, endereco: event.target.value })
                  }
                />
              </label>
              <button className="primary-button" disabled={salvando}>
                Salvar fornecedor
              </button>
            </form>
          )}
        </motion.div>
      </AnimatePresence>
    </>
  );

  return (
    <MotionConfig reducedMotion="user">
    <main className="app-shell">
      <header className="topbar">
        <div>
          <span className="brand-context">Lanchonete</span>
          <h1>Gestão de Estoque</h1>
        </div>
        <div className="topbar-actions">
          <div className="user-badge">
            <span>{usuarioLogado.nome}</span>
            <strong>{usuarioLogado.papel === 'admin' ? 'Admin' : 'Operador'}</strong>
          </div>
          <button
            aria-label={tema === 'claro' ? 'Usar tema escuro' : 'Usar tema claro'}
            className="theme-switch"
            onClick={() => setTema((atual) => (atual === 'claro' ? 'escuro' : 'claro'))}
            title={tema === 'claro' ? 'Usar tema escuro' : 'Usar tema claro'}
            type="button"
          >
            {tema === 'claro' ? <Moon aria-hidden="true" size={17} /> : <Sun aria-hidden="true" size={17} />}
            <span>{tema === 'claro' ? 'Escuro' : 'Claro'}</span>
          </button>
          <button
            aria-label="Atualizar dados"
            className="icon-button"
            onClick={() => carregarDados({ notificar: true })}
            title="Atualizar dados"
            type="button"
          >
            <RefreshCw aria-hidden="true" size={18} />
          </button>
          <button
            aria-label="Sair"
            className="icon-button"
            onClick={sair}
            title="Sair"
            type="button"
          >
            <LogOut aria-hidden="true" size={18} />
          </button>
        </div>
      </header>

      {!dashboard && erro && (
        <div className="notice notice-error" role="alert">
          {erro}
        </div>
      )}

      <section className="metrics-grid">
        <MetricCard
          active={filtrandoAlertas}
          helper={
            filtrandoAlertas
              ? 'Filtro ativo: clique para mostrar todos'
              : totalEmAlerta > 0
                ? 'Clique para filtrar itens críticos'
                : 'Todos os itens acima do mínimo'
          }
          highlighted={totalEmAlerta > 0}
          label="Itens em alerta"
          numericValue={dashboard?.totais?.produtosEmAlerta}
          onClick={() =>
            setFiltrosProduto((atual) => ({
              ...atual,
              status: atual.status === 'alerta' ? '' : 'alerta'
            }))
          }
          tone="warning"
          value="-"
        />
        <MetricCard
          label="Produtos ativos"
          numericValue={dashboard?.totais?.produtos}
          value="-"
        />
        <MetricCard
          label="Unidades no estoque"
          numericValue={dashboard?.totais?.itensEmEstoque}
          tone="stock"
          value="-"
        />
        <MetricCard
          decimals={2}
          label="Valor estimado"
          numericValue={dashboard?.totais?.valorEstoque}
          prefix={'R$\u00a0'}
          tone="money"
          value="-"
        />
      </section>

      <AnalyticsPanel
        aberto={painelAnaliticoAberto}
        buscaAtiva={busca}
        carregando={carregando}
        categoriaSelecionada={filtrosProduto.categoria}
        categorias={categorias}
        movimentacoes={movimentacoes}
        onAlternarCategoria={alternarFiltroCategoria}
        onMudarPeriodo={setPeriodoGraficos}
        onSelecionarProduto={setBusca}
        onToggle={alternarPainelAnalitico}
        periodoDias={periodoGraficos}
        produtos={produtos}
      />

      <section className={`work-grid ${(!admin || !painelCadastroAberto || isMobile) ? 'single-column' : 'with-aside'}`}>
        <div className="panel panel-wide" id="tabela-produtos">
          <div className="panel-header inventory-header">
            <div className="inventory-title-bar">
              <div>
                <h2>Produtos</h2>
              </div>
              <div className="inventory-title-actions">
                <button
                  className={admin ? 'secondary-button' : 'primary-button'}
                  onClick={() => abrirModalMovimentacao()}
                  type="button"
                >
                  <ArrowLeftRight aria-hidden="true" size={16} />
                  <span>Movimentar</span>
                </button>
                {admin && (
                  <button
                    aria-controls={!isMobile ? 'painel-cadastro' : undefined}
                    aria-expanded={painelCadastroAberto}
                    aria-haspopup={isMobile ? 'dialog' : undefined}
                    className={`toggle-cadastrar-btn ${!isMobile && painelCadastroAberto ? 'active' : ''}`}
                    onClick={() => setPainelCadastroAberto((atual) => !atual)}
                    title={!isMobile && painelCadastroAberto ? 'Ocultar formulário de cadastro' : 'Abrir formulário de cadastro'}
                    type="button"
                  >
                    {!isMobile && painelCadastroAberto ? (
                      <PanelRightClose aria-hidden="true" size={16} />
                    ) : (
                      <Plus aria-hidden="true" size={16} />
                    )}
                    <span>{!isMobile && painelCadastroAberto ? 'Ocultar cadastro' : 'Novo cadastro'}</span>
                  </button>
                )}
              </div>
            </div>
            <div className="product-filters">
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
              <button className="secondary-button filter-clear" onClick={limparFiltrosProduto} type="button">
                Limpar
              </button>
              <div className="table-search-slot">
                <ExpandingSearch
                  anchor="end"
                  collapseOnSelect={false}
                  emptyHint="Limpe os filtros ou tente outro nome, categoria ou fornecedor."
                  expandedWidth={320}
                  items={itensBuscaProdutos}
                  label="Buscar produto, categoria ou fornecedor"
                  onValueChange={setBusca}
                  placeholder="Buscar produto, categoria ou fornecedor"
                  suggestions={sugestoesBuscaProdutos}
                  suggestionsLabel={produtosEmAlerta.length > 0 ? 'Itens em alerta' : 'Produtos'}
                  value={busca}
                />
              </div>
              <div className="status-chips-bar">
                <div aria-label="Filtrar por status" className="status-chips-group" role="group">
                  {[
                    ['', 'Todos', contagensStatusProdutos.todos],
                    ['alerta', 'Em alerta', contagensStatusProdutos.alerta],
                    ['zerado', 'Zerados', contagensStatusProdutos.zerado],
                    ['ok', 'OK', contagensStatusProdutos.ok]
                  ].map(([valor, rotulo, total]) => (
                    <button
                      aria-pressed={filtrosProduto.status === valor}
                      className={`quick-chip ${filtrosProduto.status === valor ? 'active' : ''}`}
                      key={valor || 'todos'}
                      onClick={() =>
                        setFiltrosProduto((atual) => ({ ...atual, status: valor }))
                      }
                      type="button"
                    >
                      <span>{rotulo}</span>
                      <span className="chip-count">{numero(total)}</span>
                    </button>
                  ))}
                </div>
                <div aria-label="Densidade da tabela" className="density-switch" role="group">
                  {[
                    ['padrao', 'Padrão'],
                    ['compacto', 'Compacto']
                  ].map(([valor, rotulo]) => (
                    <button
                      aria-pressed={densidadeProdutos === valor}
                      className={`quick-chip ${densidadeProdutos === valor ? 'active' : ''}`}
                      key={valor}
                      onClick={() => alternarDensidadeProdutos(valor)}
                      type="button"
                    >
                      {rotulo}
                    </button>
                  ))}
                </div>
              </div>
              <div className="mobile-sort-bar">
                <select
                  aria-label="Ordenar produtos por"
                  value={ordenacaoProdutos.campo}
                  onChange={(event) =>
                    setOrdenacaoProdutos((atual) => ({ ...atual, campo: event.target.value }))
                  }
                >
                  <option value="nome">Ordenar: Nome</option>
                  <option value="categoria">Ordenar: Categoria</option>
                  <option value="fornecedor">Ordenar: Fornecedor</option>
                  <option value="quantidadeAtual">Ordenar: Quantidade</option>
                  <option value="estoqueMinimo">Ordenar: Estoque mínimo</option>
                  <option value="precoUnitario">Ordenar: Valor</option>
                  <option value="status">Ordenar: Status</option>
                </select>
                <button
                  aria-label={
                    ordenacaoProdutos.direcao === 'asc'
                      ? 'Ordem crescente, clique para inverter'
                      : 'Ordem decrescente, clique para inverter'
                  }
                  className="secondary-button mobile-sort-dir"
                  onClick={() =>
                    setOrdenacaoProdutos((atual) => ({
                      ...atual,
                      direcao: atual.direcao === 'asc' ? 'desc' : 'asc'
                    }))
                  }
                  type="button"
                >
                  {ordenacaoProdutos.direcao === 'asc' ? 'A-Z' : 'Z-A'}
                </button>
              </div>
            </div>
          </div>

          <div className="table-wrap table-wrap-responsive">
            <table
              className={`responsive-table products-table ${
                densidadeProdutos === 'compacto' ? 'is-compact' : ''
              }`}
            >
              <thead>
                <tr>
                  <th><button className="sort-button" onClick={() => alternarOrdenacao('nome')} type="button">Produto <span>{indicadorOrdenacao('nome')}</span></button></th>
                  <th><button className="sort-button" onClick={() => alternarOrdenacao('categoria')} type="button">Categoria <span>{indicadorOrdenacao('categoria')}</span></button></th>
                  <th><button className="sort-button" onClick={() => alternarOrdenacao('fornecedor')} type="button">Fornecedor <span>{indicadorOrdenacao('fornecedor')}</span></button></th>
                  <th className="col-num"><button className="sort-button sort-button-num" onClick={() => alternarOrdenacao('quantidadeAtual')} type="button">Qtd. <span>{indicadorOrdenacao('quantidadeAtual')}</span></button></th>
                  <th className="col-num"><button className="sort-button sort-button-num" onClick={() => alternarOrdenacao('estoqueMinimo')} type="button">Mín. <span>{indicadorOrdenacao('estoqueMinimo')}</span></button></th>
                  <th className="col-num"><button className="sort-button sort-button-num" onClick={() => alternarOrdenacao('precoUnitario')} type="button">Valor <span>{indicadorOrdenacao('precoUnitario')}</span></button></th>
                  <th><button className="sort-button" onClick={() => alternarOrdenacao('status')} type="button">Status <span>{indicadorOrdenacao('status')}</span></button></th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {produtosPaginados.map((item) => {
                  const qtd = Math.max(0, Number(item.quantidadeAtual || 0));
                  const min = Math.max(0, Number(item.estoqueMinimo || 0));
                  const ref = min > 0 ? min * 2 : Math.max(qtd, 1);
                  const nivelPercentual =
                    qtd === 0 ? 0 : Math.min(100, Math.max(8, Math.round((qtd / ref) * 100)));
                  const classesLinha = [
                    admin ? 'clickable-row' : '',
                    item.emAlerta ? 'row-alerta' : '',
                    qtd === 0 ? 'row-zerado' : ''
                  ]
                    .filter(Boolean)
                    .join(' ');

                  const itensMenuProduto = [
                    {
                      id: 'movimentar',
                      label: 'Movimentar estoque',
                      icon: <ArrowLeftRight size={15} />,
                      onSelect: () => abrirModalMovimentacao(item)
                    },
                    ...(admin
                      ? [
                          {
                            id: 'editar',
                            label: 'Editar produto',
                            icon: <Pencil size={15} />,
                            onSelect: () => abrirEdicaoProduto(item)
                          }
                        ]
                      : []),
                    ...(item.categoria?._id
                      ? [
                          {
                            id: 'filtrar-categoria',
                            label: 'Filtrar esta categoria',
                            icon: <Filter size={15} />,
                            onSelect: () => alternarFiltroCategoria(item.categoria._id)
                          }
                        ]
                      : []),
                    ...(admin
                      ? [
                          {
                            id: 'remover',
                            label: 'Remover produto',
                            icon: <Trash2 size={15} />,
                            destructive: true,
                            onSelect: () => solicitarRemocaoItem('produto', item)
                          }
                        ]
                      : [])
                  ];

                  return (
                  <ContextMenu
                    as="tr"
                    className={classesLinha || undefined}
                    items={itensMenuProduto}
                    key={item._id}
                    label={`Opções de ${item.nome}`}
                    onClick={admin ? () => abrirEdicaoProduto(item) : undefined}
                    openOnClick={false}
                  >
                    <td className="cell-primary">
                      <strong>{item.nome}</strong>
                      <span>{item.unidadeMedida}</span>
                    </td>
                    <td className="cell-category" data-label="Categoria">{item.categoria?.nome || '-'}</td>
                    <td className="cell-supplier" data-label="Fornecedor">{item.fornecedor?.nome || '-'}</td>
                    <td className="cell-qty col-num" data-label="Qtd.">
                      <div className="qty-cell">
                        <strong>{numero(item.quantidadeAtual)}</strong>
                        <div aria-hidden="true" className="stock-meter">
                          <span
                            className={`stock-meter-fill ${item.emAlerta ? 'is-alert' : ''}`}
                            style={{ width: `${nivelPercentual}%` }}
                          />
                        </div>
                      </div>
                    </td>
                    <td className="cell-min col-num" data-label="Mín.">{numero(item.estoqueMinimo)}</td>
                    <td className="cell-price col-num" data-label="Valor">{moeda(item.precoUnitario)}</td>
                    <td className="cell-status" data-label="Status">
                      <span className={`status ${item.emAlerta ? 'danger' : 'ok'}`}>
                        {item.emAlerta ? (
                          <AlertTriangle aria-hidden="true" size={15} />
                        ) : (
                          <CheckCircle2 aria-hidden="true" size={15} />
                        )}
                        {qtd === 0 ? 'Zerado' : item.emAlerta ? 'Alerta' : 'OK'}
                      </span>
                    </td>
                    <td className="cell-actions" onClick={(event) => event.stopPropagation()}>
                      {admin ? (
                        <div onClick={(event) => event.stopPropagation()}>
                          <DropdownMenu
                            ariaLabel={`Ações para ${item.nome}`}
                            items={[
                              {
                                label: 'Editar produto',
                                icon: <Pencil size={15} />,
                                onSelect: () => abrirEdicaoProduto(item)
                              },
                              {
                                label: 'Movimentar estoque',
                                icon: <ArrowLeftRight size={15} />,
                                onSelect: () => abrirModalMovimentacao(item)
                              },
                              {
                                label: 'Remover produto',
                                icon: <Trash2 size={15} />,
                                destructive: true,
                                separatorBefore: true,
                                onSelect: () => solicitarRemocaoItem('produto', item)
                              }
                            ]}
                            label="Ações"
                          />
                        </div>
                      ) : (
                        <button
                          aria-label={`Movimentar estoque de ${item.nome}`}
                          className="table-action"
                          onClick={() => abrirModalMovimentacao(item)}
                          type="button"
                        >
                          <ArrowLeftRight aria-hidden="true" size={15} />
                          Movimentar
                        </button>
                      )}
                    </td>
                  </ContextMenu>
                  );
                })}
              </tbody>
            </table>
          </div>

          {!carregando && totalProdutosFiltrados > 0 && (
            <div className="table-footer">
              <span className="table-footer-count">
                Mostrando {numero(inicioMostradoProdutos)} a {numero(fimMostradoProdutos)} de{' '}
                {numero(totalProdutosFiltrados)}
              </span>
              <div className="table-footer-controls">
                <div aria-label="Itens por página" className="page-size-group" role="group">
                  {OPCOES_PAGINA_PRODUTOS.map((opcao) => (
                    <button
                      aria-pressed={itensPorPaginaProdutos === opcao}
                      className={`quick-chip ${itensPorPaginaProdutos === opcao ? 'active' : ''}`}
                      key={String(opcao)}
                      onClick={() => setItensPorPaginaProdutos(opcao)}
                      type="button"
                    >
                      {opcao === 'all' ? 'Todos' : opcao}
                    </button>
                  ))}
                </div>
                {totalPaginasProdutos > 1 && (
                  <div aria-label="Paginação" className="pagination-controls" role="group">
                    <button
                      className="secondary-button pagination-btn"
                      disabled={paginaSeguraProdutos <= 1}
                      onClick={() => setPaginaProdutos((atual) => Math.max(1, atual - 1))}
                      type="button"
                    >
                      Anterior
                    </button>
                    <span className="pagination-status">
                      {paginaSeguraProdutos} / {totalPaginasProdutos}
                    </span>
                    <button
                      className="secondary-button pagination-btn"
                      disabled={paginaSeguraProdutos >= totalPaginasProdutos}
                      onClick={() =>
                        setPaginaProdutos((atual) => Math.min(totalPaginasProdutos, atual + 1))
                      }
                      type="button"
                    >
                      Próxima
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {carregando && (
            <div className="loading-state" role="status" aria-live="polite">
              Carregando produtos do estoque...
            </div>
          )}

          {!carregando && produtosFiltrados.length === 0 && (
            temFiltrosProdutoAtivos ? (
              <EmptyState
                actionLabel="Limpar filtros"
                onAction={limparFiltrosProduto}
                text="Limpe os filtros ativos para voltar a ver todos os produtos cadastrados."
                title="Nenhum produto corresponde aos filtros"
              />
            ) : (
              <EmptyState
                text={
                  admin
                    ? 'Use o botão Novo cadastro para cadastrar o primeiro produto.'
                    : 'Nenhum item cadastrado no estoque no momento.'
                }
                title="Nenhum produto cadastrado"
              />
            )
          )}
        </div>

        {admin && !isMobile && (
        <aside
          aria-hidden={!painelCadastroAberto}
          className={`panel aside-form-panel ${painelCadastroAberto ? 'open' : 'closed'}`}
          id="painel-cadastro"
          inert={!painelCadastroAberto ? true : undefined}
        >
          <div className="aside-form-inner">
            {conteudoCadastro}
          </div>
        </aside>
        )}
      </section>

      <section className="panel supplier-panel">
        <div className="panel-header">
          <div>
            <h2>Fornecedores</h2>
          </div>
        </div>

        <div className="table-wrap table-wrap-responsive">
          <table className="compact-table responsive-table suppliers-table">
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
                <ContextMenu
                  as="tr"
                  className="clickable-row"
                  items={[
                    {
                      id: 'detalhes',
                      label: 'Ver detalhes',
                      icon: <Eye size={15} />,
                      onSelect: () => setFornecedorSelecionado(item)
                    },
                    {
                      id: 'filtrar-produtos',
                      label: 'Filtrar produtos',
                      icon: <Filter size={15} />,
                      onSelect: () => {
                        setFiltrosProduto((atual) => ({ ...atual, fornecedor: item._id }));
                        rolarParaSecao('tabela-produtos');
                      }
                    },
                    ...(admin
                      ? [
                          {
                            id: 'remover',
                            label: 'Remover fornecedor',
                            icon: <Trash2 size={15} />,
                            destructive: true,
                            onSelect: () => solicitarRemocaoItem('fornecedor', item)
                          }
                        ]
                      : [])
                  ]}
                  key={item._id}
                  label={`Opções para ${item.nome}`}
                  onClick={() => setFornecedorSelecionado(item)}
                  openOnClick={false}
                >
                  <td className="cell-primary">
                    <button
                      className="row-trigger-button"
                      onClick={(event) => {
                        event.stopPropagation();
                        setFornecedorSelecionado(item);
                      }}
                      type="button"
                    >
                      <strong>{item.nome}</strong>
                    </button>
                    <span>{item.endereco || 'Sem endereço'}</span>
                  </td>
                  <td className="cell-phone" data-label="Telefone">{item.telefone || '-'}</td>
                  <td className="cell-email" data-label="Email">{item.email || '-'}</td>
                  <td className="cell-cnpj" data-label="CNPJ">{item.cnpj || '-'}</td>
                </ContextMenu>
              ))}
            </tbody>
          </table>
        </div>

        {carregando && (
          <div className="loading-state" role="status" aria-live="polite">
            Carregando fornecedores...
          </div>
        )}

        {!carregando && fornecedores.length === 0 && (
          <EmptyState
            title="Nenhum fornecedor cadastrado"
            text="Cadastre fornecedores para consultá-los nesta tabela."
          />
        )}
      </section>

      {admin && (
        <section className="panel users-panel">
          <div className="panel-header">
            <div>
              <h2>Usuários do sistema</h2>
              <p className="panel-hint">Contas inativas são removidas automaticamente após 60 dias.</p>
            </div>
          </div>

          <div className="users-grid">
            <form className="form" id="form-usuario" onSubmit={salvarUsuario}>
              {usuarioEditando && (
                <div aria-live="polite" className="editing-banner" role="status">
                  <span>
                    Editando usuário: <strong>{usuarioEditando.nome}</strong> ({usuarioEditando.email})
                  </span>
                </div>
              )}
              <div className="form-row">
                <label>
                  Nome
                  <input
                    ref={nomeUsuarioRef}
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
                    minLength={8}
                    type="password"
                    value={usuarioForm.senha}
                    onChange={(event) => setUsuarioForm({ ...usuarioForm, senha: event.target.value })}
                    placeholder={usuarioEditando ? 'Deixe em branco para manter' : 'Mínimo de 8 caracteres'}
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
                    Usuário ativo
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
                      placeholder="Obrigatória para alterar login"
                    />
                  </label>
                </>
              )}
              <div className="form-actions">
                <button className="primary-button user-submit-btn" disabled={salvando} type="submit">
                  {usuarioEditando ? 'Salvar usuário' : 'Cadastrar usuário'}
                </button>
                {usuarioEditando && (
                  <button className="secondary-button user-cancel-btn" onClick={cancelarEdicaoUsuario} type="button">
                    Cancelar
                  </button>
                )}
              </div>
            </form>

            <div className="users-table-column">
              {usuarios.length > 0 && (
                <div className="users-filters">
                  <div aria-label="Filtrar usuários por perfil" className="chip-filter-group" role="group">
                    {[
                      ['', 'Todos perfis'],
                      ['admin', 'Admin'],
                      ['operador', 'Operador']
                    ].map(([valor, rotulo]) => (
                      <button
                        aria-pressed={filtroPerfilUsuario === valor}
                        className={`quick-chip ${filtroPerfilUsuario === valor ? 'active' : ''}`}
                        key={valor || 'todos-perfis'}
                        onClick={() => setFiltroPerfilUsuario(valor)}
                        type="button"
                      >
                        {rotulo}
                      </button>
                    ))}
                  </div>
                  <div aria-label="Filtrar usuários por status" className="chip-filter-group" role="group">
                    {[
                      ['', 'Todos status'],
                      ['ativo', 'Ativos'],
                      ['inativo', 'Inativos']
                    ].map(([valor, rotulo]) => (
                      <button
                        aria-pressed={filtroStatusUsuario === valor}
                        className={`quick-chip ${filtroStatusUsuario === valor ? 'active' : ''}`}
                        key={valor || 'todos-status'}
                        onClick={() => setFiltroStatusUsuario(valor)}
                        type="button"
                      >
                        {rotulo}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="table-wrap table-wrap-responsive users-table-wrap">
                <table className="compact-table responsive-table users-table">
                  <thead>
                    <tr>
                      <th>Usuário</th>
                      <th>Perfil</th>
                      <th>Status</th>
                      <th className="col-num">Movs.</th>
                      <th>Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {usuariosFiltrados.map((item) => {
                      const totalMovUsuario =
                        movimentacoesPorUsuario.get(String(item.nome || '').trim().toLowerCase()) || 0;
                      const textoRemocao = obterTextoRemocaoInativo(item);
                      return (
                      <ContextMenu
                        as="tr"
                        items={[
                          {
                            id: 'editar-usuario',
                            label: 'Editar usuário',
                            icon: <Pencil size={15} />,
                            onSelect: () => editarUsuario(item)
                          },
                          {
                            id: 'ver-movimentacoes',
                            label: 'Ver movimentações',
                            icon: <Filter size={15} />,
                            onSelect: () => {
                              setBuscaMov(item.nome);
                              rolarParaSecao('historico-movimentacoes');
                            }
                          }
                        ]}
                        key={item._id}
                        label={`Opções de ${item.nome}`}
                        openOnClick={false}
                      >
                        <td className="cell-primary">
                          <strong>{item.nome}</strong>
                          <span>{item.email}</span>
                        </td>
                        <td className="cell-role" data-label="Perfil">{item.papel === 'admin' ? 'Admin' : 'Operador'}</td>
                        <td className="cell-status" data-label="Status">
                          <div className="user-status-stack">
                            <span className={`status ${item.ativo ? 'ok' : 'danger'}`}>
                              {item.ativo ? 'Ativo' : 'Inativo'}
                            </span>
                            {textoRemocao && (
                              <span
                                className="inactive-countdown"
                                title="Contas inativas por mais de 60 dias são removidas automaticamente."
                              >
                                {textoRemocao}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="cell-user-movs col-num" data-label="Movimentações">
                          {numero(totalMovUsuario)}
                        </td>
                        <td className="cell-actions">
                          <button className="table-action" onClick={() => editarUsuario(item)} type="button">
                            Editar
                          </button>
                        </td>
                      </ContextMenu>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {carregandoUsuarios && (
                <div className="loading-state" role="status" aria-live="polite">
                  Carregando usuários...
                </div>
              )}

              {!carregandoUsuarios && usuarios.length === 0 && (
                <EmptyState
                  text="Preencha o formulário ao lado para criar o primeiro usuário."
                  title="Nenhum usuário cadastrado"
                />
              )}

              {!carregandoUsuarios && usuarios.length > 0 && usuariosFiltrados.length === 0 && (
                <EmptyState
                  actionLabel="Limpar filtros"
                  onAction={limparFiltrosUsuarios}
                  text="Altere os filtros de perfil ou status para voltar a listar os usuários."
                  title="Nenhum usuário corresponde aos filtros"
                />
              )}
            </div>
          </div>
        </section>
      )}

      <section className="panel history-panel" id="historico-movimentacoes">
        <div className="panel-header">
          <div>
            <h2>Últimas movimentações</h2>
          </div>
          <div className="panel-header-actions">
            <button
              className="primary-button history-move-btn"
              onClick={() => abrirModalMovimentacao()}
              type="button"
            >
              <ArrowLeftRight aria-hidden="true" size={16} />
              Movimentar
            </button>
            <button
              className="secondary-button summary-button"
              onClick={() => setResumoAberto(true)}
              type="button"
            >
              Resumo
            </button>
          </div>
        </div>

        <div className="movements-filters">
          <div aria-label="Filtrar movimentações por tipo" className="chip-filter-group" role="group">
            {[
              ['', 'Todas', contagensTipoMov.todas],
              ['entrada', 'Entrada', contagensTipoMov.entrada],
              ['saida', 'Saída', contagensTipoMov.saida],
              ['ajuste', 'Ajuste', contagensTipoMov.ajuste]
            ].map(([valor, rotulo, total]) => (
              <button
                aria-pressed={filtroTipoMov === valor}
                className={`quick-chip ${filtroTipoMov === valor ? 'active' : ''}`}
                key={valor || 'todas'}
                onClick={() => setFiltroTipoMov(valor)}
                type="button"
              >
                <span>{rotulo}</span>
                <span className="chip-count">{numero(total)}</span>
              </button>
            ))}
          </div>
          <div className="movements-search-controls">
            <label className="sr-only" htmlFor="busca-movimentacoes-input">
              Buscar nas movimentações
            </label>
            <input
              id="busca-movimentacoes-input"
              onChange={(event) => setBuscaMov(event.target.value)}
              placeholder="Buscar produto, usuário ou observação..."
              type="search"
              value={buscaMov}
            />
            {temFiltrosMovAtivos && (
              <button className="secondary-button" onClick={limparFiltrosMov} type="button">
                Limpar
              </button>
            )}
          </div>
        </div>

        <div className="table-wrap table-wrap-responsive">
          <table className="responsive-table movements-table">
            <thead>
              <tr>
                <th>Produto</th>
                <th>Tipo</th>
                <th className="col-num">Qtd.</th>
                <th>Responsável</th>
                <th>Data</th>
                <th>Observação</th>
              </tr>
            </thead>
            <tbody>
              {movimentacoesVisiveis.map((item) => {
                const produtoRelacionado = produtos.find(
                  (prod) => prod._id === (item.produto?._id || item.produto)
                );
                const itensMenuMov = [
                  {
                    id: 'detalhes',
                    label: 'Ver detalhes',
                    icon: <Eye size={15} />,
                    onSelect: () => setMovimentacaoSelecionada(item)
                  },
                  ...(produtoRelacionado
                    ? [
                        {
                          id: 'movimentar',
                          label: 'Movimentar produto',
                          icon: <ArrowLeftRight size={15} />,
                          onSelect: () => abrirModalMovimentacao(produtoRelacionado)
                        }
                      ]
                    : []),
                  ...(item.produto?.nome
                    ? [
                        {
                          id: 'filtrar',
                          label: 'Filtrar este produto',
                          icon: <Filter size={15} />,
                          onSelect: () => setBuscaMov(item.produto.nome)
                        }
                      ]
                    : [])
                ];

                return (
                <ContextMenu
                  as="tr"
                  className="clickable-row"
                  items={itensMenuMov}
                  key={item._id}
                  label={`Opções da movimentação de ${item.produto?.nome || 'produto'}`}
                  onClick={() => setMovimentacaoSelecionada(item)}
                  openOnClick={false}
                >
                  <td className="cell-primary">
                    <button
                      className="row-trigger-button"
                      onClick={(event) => {
                        event.stopPropagation();
                        setMovimentacaoSelecionada(item);
                      }}
                      type="button"
                    >
                      <strong>{item.produto?.nome || 'Produto removido'}</strong>
                    </button>
                    <span>
                      {item.produto?.categoria?.nome || 'Sem categoria'}
                    </span>
                  </td>
                  <td className="cell-type" data-label="Tipo">
                    <span className={`movement-badge ${item.tipo}`}>
                      {item.tipo === 'entrada' ? (
                        <ArrowUp aria-hidden="true" size={14} />
                      ) : item.tipo === 'saida' ? (
                        <ArrowDown aria-hidden="true" size={14} />
                      ) : (
                        <SlidersHorizontal aria-hidden="true" size={14} />
                      )}
                      {rotuloTipoMovimentacao(item.tipo)}
                    </span>
                  </td>
                  <td className="cell-qty col-num" data-label="Qtd.">
                    {numero(item.quantidade)} {item.produto?.unidadeMedida || 'un'}
                  </td>
                  <td className="cell-user" data-label="Responsável">
                    {item.usuario || '-'}
                  </td>
                  <td className="cell-date" data-label="Data">
                    {dataCurta(item.createdAt)}
                  </td>
                  <td className="cell-note" data-label="Observação">
                    {item.observacao || '-'}
                  </td>
                </ContextMenu>
                );
              })}
            </tbody>
          </table>
        </div>

        {carregando && (
          <div className="loading-state" role="status" aria-live="polite">
            Carregando histórico de movimentações...
          </div>
        )}

        {totalMovimentacoesOcultas > 0 && (
          <button
            aria-expanded={mostrarMovimentacoesAntigas}
            className="secondary-button history-toggle"
            onClick={() => setMostrarMovimentacoesAntigas((atual) => !atual)}
            type="button"
          >
            {mostrarMovimentacoesAntigas
              ? 'Mostrar apenas recentes'
              : `Mostrar ${totalMovimentacoesOcultas} ${
                  totalMovimentacoesOcultas === 1 ? 'movimentação antiga' : 'movimentações antigas'
                }`}
          </button>
        )}

        {!carregando && movimentacoes.length === 0 && (
          <EmptyState
            title="Sem movimentações"
            text="As entradas, saídas e ajustes vão aparecer aqui."
          />
        )}

        {!carregando && movimentacoes.length > 0 && movimentacoesFiltradas.length === 0 && (
          <EmptyState
            actionLabel="Limpar filtros"
            onAction={limparFiltrosMov}
            title="Nenhuma movimentação encontrada"
            text="Limpe ou altere o filtro de tipo e busca para ver o histórico."
          />
        )}
      </section>

      {produtoEditando && produtoEdicao && (
        <ModalDialog
          className="product-edit-modal"
          onClose={fecharEdicaoProduto}
          titleId="produto-edicao-titulo"
        >
            <div className="modal-header">
              <div>
                <h2 id="produto-edicao-titulo">Editar produto</h2>
              </div>
              <button
                aria-label="Fechar edição de produto"
                className="icon-button modal-close"
                onClick={fecharEdicaoProduto}
                title="Fechar"
                type="button"
              >
                <X aria-hidden="true" size={18} />
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
                  Estoque mínimo
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
                  Preço unitário
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
                Revise as alterações antes de confirmar. A atualização será aplicada ao estoque.
              </p>
              <div className="form-actions">
                <button className="primary-button" disabled={salvando} type="submit">
                  Confirmar alteração
                </button>
                <button className="secondary-button" onClick={fecharEdicaoProduto} type="button">
                  Cancelar
                </button>
              </div>
            </form>
        </ModalDialog>
      )}

      {movimentacaoSelecionada && (
        <ModalDialog
          onClose={() => setMovimentacaoSelecionada(null)}
          titleId="movimentacao-titulo"
        >
            <div className="modal-header">
              <div>
                <span className="modal-subtitle">Movimentação</span>
                <h2 id="movimentacao-titulo">
                  {movimentacaoSelecionada.produto?.nome || 'Produto removido'}
                </h2>
              </div>
              <button
                aria-label="Fechar detalhes da movimentação"
                className="icon-button modal-close"
                onClick={() => setMovimentacaoSelecionada(null)}
                title="Fechar"
                type="button"
              >
                <X aria-hidden="true" size={18} />
              </button>
            </div>

            <div className="detail-grid">
              <div>
                <span>Tipo</span>
                <strong>{rotuloTipoMovimentacao(movimentacaoSelecionada.tipo)}</strong>
              </div>
              <div>
                <span>Quantidade</span>
                <strong>{numero(movimentacaoSelecionada.quantidade)}</strong>
              </div>
              <div>
                <span>Usuário</span>
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
              <span>Observação</span>
              <p>{movimentacaoSelecionada.observacao || 'Sem observação registrada.'}</p>
            </div>

            <div className="modal-footer-actions">
              {(() => {
                const prodRel = produtos.find(
                  (p) => p._id === (movimentacaoSelecionada.produto?._id || movimentacaoSelecionada.produto)
                );
                return prodRel ? (
                  <button
                    className="primary-button"
                    onClick={() => {
                      setMovimentacaoSelecionada(null);
                      abrirModalMovimentacao(prodRel);
                    }}
                    type="button"
                  >
                    <ArrowLeftRight aria-hidden="true" size={16} />
                    Movimentar produto
                  </button>
                ) : null;
              })()}
              <button
                className="secondary-button"
                onClick={() => setMovimentacaoSelecionada(null)}
                type="button"
              >
                Fechar
              </button>
            </div>
        </ModalDialog>
      )}

      {fornecedorSelecionado && (
        <ModalDialog
          onClose={() => setFornecedorSelecionado(null)}
          titleId="fornecedor-titulo"
        >
            <div className="modal-header">
              <div>
                <span className="modal-subtitle">Fornecedor</span>
                <h2 id="fornecedor-titulo">{fornecedorSelecionado.nome}</h2>
              </div>
              <button
                aria-label="Fechar detalhes do fornecedor"
                className="icon-button modal-close"
                onClick={() => setFornecedorSelecionado(null)}
                title="Fechar"
                type="button"
              >
                <X aria-hidden="true" size={18} />
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
              <div className="detail-span-full">
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
              <span>Endereço</span>
              <p>{fornecedorSelecionado.endereco || 'Sem endereço registrado.'}</p>
            </div>

            <div className="modal-footer-actions">
              <button
                className="primary-button"
                onClick={() => {
                  const idForn = fornecedorSelecionado._id;
                  setFornecedorSelecionado(null);
                  setFiltrosProduto((atual) => ({ ...atual, fornecedor: idForn }));
                  rolarParaSecao('tabela-produtos');
                }}
                type="button"
              >
                <Filter aria-hidden="true" size={16} />
                Filtrar produtos
              </button>
              <button
                className="secondary-button"
                onClick={() => setFornecedorSelecionado(null)}
                type="button"
              >
                Fechar
              </button>
            </div>
        </ModalDialog>
      )}

      {resumoAberto && (
        <ModalDialog
          className="summary-modal"
          onClose={() => setResumoAberto(false)}
          titleId="resumo-titulo"
        >
            <div className="modal-header">
              <div>
                <h2 id="resumo-titulo">Movimentações por período</h2>
              </div>
              <button
                aria-label="Fechar resumo"
                className="icon-button modal-close"
                onClick={() => setResumoAberto(false)}
                title="Fechar"
                type="button"
              >
                <X aria-hidden="true" size={18} />
              </button>
            </div>

            <div aria-label="Período do resumo" className="period-tabs" role="tablist">
              {Object.entries(PERIODOS_RESUMO).map(([valor, periodo]) => (
                <button
                  aria-selected={periodoResumo === valor}
                  className={periodoResumo === valor ? 'active' : ''}
                  key={valor}
                  onClick={() => setPeriodoResumo(valor)}
                  role="tab"
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
                <span>Saídas</span>
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
                      <span>Saída: {numero(item.saida)}</span>
                      <span>Ajuste: {numero(item.ajuste)}</span>
                    </div>
                  </article>
                ))
              ) : (
                <p className="summary-empty">Nenhuma movimentação nesse período.</p>
              )}
            </div>
        </ModalDialog>
      )}

      {modalMovimentacaoAberto && (
        <ModalDialog
          className="movement-modal"
          onClose={fecharModalMovimentacao}
          titleId="movimentacao-modal-titulo"
        >
          <div className="modal-header">
            <div>
              <h2 id="movimentacao-modal-titulo">Movimentar estoque</h2>
            </div>
            <button
              aria-label="Fechar movimentação de estoque"
              className="icon-button modal-close"
              disabled={salvando}
              onClick={fecharModalMovimentacao}
              title="Fechar"
              type="button"
            >
              <X aria-hidden="true" size={18} />
            </button>
          </div>

          <form className="form" onSubmit={salvarMovimentacao}>
            <label>
              Produto
              <select
                required
                value={movimentacao.produto}
                onChange={(event) =>
                  setMovimentacao((atual) => ({ ...atual, produto: event.target.value }))
                }
              >
                <option value="">Selecione um produto</option>
                {produtos.map((item) => (
                  <option key={item._id} value={item._id}>
                    {item.nome} ({numero(item.quantidadeAtual)} {item.unidadeMedida})
                  </option>
                ))}
              </select>
            </label>

            <div>
              <div aria-label="Tipo de movimentação" className="movement-options" role="group">
                {[
                  ['entrada', ArrowUp, 'Entrada'],
                  ['saida', ArrowDown, 'Saída'],
                  ['ajuste', SlidersHorizontal, 'Ajuste']
                ].map(([tipo, Icone, label]) => (
                  <button
                    aria-pressed={movimentacao.tipo === tipo}
                    className={movimentacao.tipo === tipo ? 'active' : ''}
                    key={tipo}
                    onClick={() => selecionarTipoMovimentacao(tipo)}
                    type="button"
                  >
                    <Icone aria-hidden="true" size={16} />
                    {label}
                  </button>
                ))}
              </div>
              {movimentacao.tipo === 'ajuste' && (
                <p className="movement-hint">
                  Ajuste substitui o saldo atual pelo valor informado.
                </p>
              )}
            </div>

            {produtoMovSelecionado && (
              <div
                aria-live="polite"
                className={`movement-preview ${
                  saldoInsuficienteMov ? 'is-invalid' : ficaraEmAlertaMov ? 'is-warning' : ''
                }`}
                role="status"
              >
                <div className="movement-preview-values">
                  <div>
                    <span>Saldo atual</span>
                    <strong>
                      {numero(saldoAtualMov)} {produtoMovSelecionado.unidadeMedida}
                    </strong>
                  </div>
                  <div>
                    <span>Novo saldo</span>
                    <strong>
                      {numero(novoSaldoMov)} {produtoMovSelecionado.unidadeMedida}
                    </strong>
                  </div>
                </div>
                {saldoInsuficienteMov && (
                  <p className="movement-preview-note">
                    <AlertTriangle aria-hidden="true" size={15} />
                    Quantidade superior ao saldo disponível ({numero(saldoAtualMov)}{' '}
                    {produtoMovSelecionado.unidadeMedida}).
                  </p>
                )}
                {!saldoInsuficienteMov && ficaraEmAlertaMov && (
                  <p className="movement-preview-note">
                    <AlertTriangle aria-hidden="true" size={15} />
                    O novo saldo ficará no limite ou abaixo do mínimo (
                    {numero(produtoMovSelecionado.estoqueMinimo)} {produtoMovSelecionado.unidadeMedida}
                    ).
                  </p>
                )}
              </div>
            )}

            <div className="field-block">
              <label htmlFor="mov-quantidade-input">Quantidade</label>
              <div className="qty-stepper">
                <button
                  aria-label="Diminuir quantidade"
                  className="qty-step-btn"
                  disabled={salvando || !qtdMovValida || qtdMovNumero <= 1}
                  onClick={() =>
                    setMovimentacao((atual) => ({
                      ...atual,
                      quantidade: Math.max(1, Math.floor(Number(atual.quantidade) || 1) - 1)
                    }))
                  }
                  type="button"
                >
                  <Minus aria-hidden="true" size={16} />
                </button>
                <input
                  id="mov-quantidade-input"
                  min="1"
                  ref={quantidadeMovRef}
                  required
                  type="number"
                  value={movimentacao.quantidade}
                  onChange={(event) =>
                    setMovimentacao((atual) => ({ ...atual, quantidade: event.target.value }))
                  }
                />
                <button
                  aria-label="Aumentar quantidade"
                  className="qty-step-btn"
                  disabled={salvando}
                  onClick={() =>
                    setMovimentacao((atual) => ({
                      ...atual,
                      quantidade: Math.max(0, Math.floor(Number(atual.quantidade) || 0)) + 1
                    }))
                  }
                  type="button"
                >
                  <Plus aria-hidden="true" size={16} />
                </button>
              </div>
              <div aria-label="Atalhos de quantidade" className="qty-shortcuts" role="group">
                {[1, 5, 10].map((incremento) => (
                  <button
                    className="quick-chip"
                    disabled={salvando}
                    key={incremento}
                    onClick={() =>
                      setMovimentacao((atual) => ({
                        ...atual,
                        quantidade: Math.max(0, Number(atual.quantidade) || 0) + incremento
                      }))
                    }
                    type="button"
                  >
                    +{incremento}
                  </button>
                ))}
                {movimentacao.tipo === 'saida' && saldoAtualMov > 0 && (
                  <button
                    className={`quick-chip ${qtdMovNumero === saldoAtualMov ? 'active' : ''}`}
                    disabled={salvando}
                    onClick={() =>
                      setMovimentacao((atual) => ({ ...atual, quantidade: saldoAtualMov }))
                    }
                    type="button"
                  >
                    Tudo ({numero(saldoAtualMov)})
                  </button>
                )}
                {movimentacao.tipo === 'ajuste' &&
                  Number(produtoMovSelecionado?.estoqueMinimo || 0) > 0 && (
                    <button
                      className={`quick-chip ${
                        qtdMovNumero === Number(produtoMovSelecionado.estoqueMinimo) ? 'active' : ''
                      }`}
                      disabled={salvando}
                      onClick={() =>
                        setMovimentacao((atual) => ({
                          ...atual,
                          quantidade: Number(produtoMovSelecionado.estoqueMinimo)
                        }))
                      }
                      type="button"
                    >
                      Mínimo ({numero(produtoMovSelecionado.estoqueMinimo)})
                    </button>
                  )}
              </div>
            </div>

            <div className="field-block">
              <span className="field-caption">Motivo rápido</span>
              <div aria-label="Motivos rápidos" className="reason-chips" role="group">
                {(MOTIVOS_MOVIMENTACAO[movimentacao.tipo] || []).map((motivo) => {
                  const ativo = movimentacao.observacao === motivo;
                  return (
                    <button
                      aria-pressed={ativo}
                      className={`quick-chip ${ativo ? 'active' : ''}`}
                      disabled={salvando}
                      key={motivo}
                      onClick={() =>
                        setMovimentacao((atual) => ({
                          ...atual,
                          observacao: atual.observacao === motivo ? '' : motivo
                        }))
                      }
                      type="button"
                    >
                      {motivo}
                    </button>
                  );
                })}
              </div>
            </div>

            <label>
              Observação (opcional)
              <input
                placeholder="Ou escreva um motivo personalizado..."
                type="text"
                value={movimentacao.observacao}
                onChange={(event) =>
                  setMovimentacao((atual) => ({ ...atual, observacao: event.target.value }))
                }
              />
            </label>

            <div className="form-actions">
              <button
                className="primary-button"
                disabled={salvando || !produtoMovSelecionado || !qtdMovValida || saldoInsuficienteMov}
                type="submit"
              >
                {movimentacao.tipo === 'entrada'
                  ? 'Registrar entrada'
                  : movimentacao.tipo === 'saida'
                    ? 'Registrar saída'
                    : 'Aplicar ajuste'}
              </button>
              <button
                className="secondary-button"
                disabled={salvando}
                onClick={fecharModalMovimentacao}
                type="button"
              >
                Cancelar
              </button>
            </div>
          </form>
        </ModalDialog>
      )}

      {admin && isMobile && painelCadastroAberto && (
        <ModalDialog
          className="cadastro-modal"
          onClose={() => !salvando && setPainelCadastroAberto(false)}
          titleId="cadastro-modal-titulo"
        >
          {conteudoCadastro}
        </ModalDialog>
      )}

      {itemParaRemover && (
        <ModalDialog
          className="delete-confirm-modal"
          onClose={fecharRemocaoItem}
          titleId="item-remocao-titulo"
        >
          <div className="modal-header">
            <div>
              <h2 id="item-remocao-titulo">
                {itemParaRemover.tipo === 'fornecedor' ? 'Remover fornecedor' : 'Remover produto'}
              </h2>
            </div>
            <button
              aria-label="Fechar confirmação de remoção"
              className="icon-button modal-close"
              disabled={salvando}
              onClick={fecharRemocaoItem}
              title="Fechar"
              type="button"
            >
              <X aria-hidden="true" size={18} />
            </button>
          </div>

          <div className="delete-confirm-summary">
            <strong>{itemParaRemover.item.nome}</strong>
            <span>
              {itemParaRemover.tipo === 'fornecedor'
                ? itemParaRemover.item.email ||
                  itemParaRemover.item.telefone ||
                  itemParaRemover.item.cnpj ||
                  'Sem contato informado'
                : `${itemParaRemover.item.categoria?.nome || 'Sem categoria'} · ${numero(itemParaRemover.item.quantidadeAtual)} ${itemParaRemover.item.unidadeMedida}`}
            </span>
          </div>

          <p className="confirm-note delete-confirm-note">
            {itemParaRemover.tipo === 'fornecedor'
              ? 'Esta ação remove o fornecedor caso não haja produtos ativos vinculados. Segure o botão abaixo para confirmar.'
              : 'Esta ação remove o item do catálogo ativo do estoque. Segure o botão abaixo para confirmar.'}
          </p>

          <div className="delete-confirm-actions">
            <HoldToConfirm
              key={`${itemParaRemover.tipo}-${itemParaRemover.item._id}`}
              confirmed={remocaoConfirmada}
              confirmedLabel="Removido"
              disabled={salvando}
              duration={1100}
              label="Segure para remover"
              onConfirm={confirmarRemocaoItem}
              tone="danger"
            />
            <button
              className="secondary-button"
              disabled={salvando}
              onClick={fecharRemocaoItem}
              type="button"
            >
              Cancelar
            </button>
          </div>
        </ModalDialog>
      )}

      <div className="toast-viewport">
        <Toast
          description={toast.description || undefined}
          duration={4500}
          onOpenChange={lidarMudancaToast}
          open={toast.open}
          title={toast.title}
          tone={toast.tone}
        />
      </div>
    </main>
    </MotionConfig>
  );
}
