import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  Boxes,
  CheckCircle2,
  PackagePlus,
  RefreshCw,
  Save,
  Search,
  SlidersHorizontal,
  Truck
} from 'lucide-react';
import React from 'react';
import { useEffect, useMemo, useState } from 'react';
import { EmptyState } from './components/EmptyState.jsx';
import { MetricCard } from './components/MetricCard.jsx';
import { api } from './services/api.js';

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
const movimentacaoInicial = {
  produto: '',
  tipo: 'entrada',
  quantidade: 1,
  usuario: 'Operador',
  observacao: ''
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
  const [aba, setAba] = useState('produto');
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [mensagem, setMensagem] = useState('');
  const [erro, setErro] = useState('');

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

  useEffect(() => {
    carregarDados();
  }, []);

  const produtosFiltrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();

    if (!termo) {
      return produtos;
    }

    return produtos.filter((item) => {
      return [
        item.nome,
        item.categoria?.nome,
        item.fornecedor?.nome,
        item.unidadeMedida
      ]
        .filter(Boolean)
        .some((valor) => valor.toLowerCase().includes(termo));
    });
  }, [busca, produtos]);

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

  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <span className="eyebrow">Lanchonete</span>
          <h1>Gestao de Estoque</h1>
        </div>
        <button className="icon-button" onClick={carregarDados} title="Atualizar dados">
          <RefreshCw size={18} />
        </button>
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
          <div className="panel-header">
            <div>
              <span className="eyebrow">Inventario</span>
              <h2>Produtos</h2>
            </div>
            <label className="search-box">
              <Search size={17} />
              <input
                value={busca}
                onChange={(event) => setBusca(event.target.value)}
                placeholder="Buscar produto, categoria ou fornecedor"
              />
            </label>
          </div>

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Produto</th>
                  <th>Categoria</th>
                  <th>Fornecedor</th>
                  <th>Qtd.</th>
                  <th>Min.</th>
                  <th>Valor</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {produtosFiltrados.map((item) => (
                  <tr key={item._id}>
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
      </section>

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
          </div>

          <div className="timeline">
            {movimentacoes.map((item) => (
              <article key={item._id} className="timeline-item">
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
              </article>
            ))}
          </div>

          {!carregando && movimentacoes.length === 0 && (
            <EmptyState
              title="Sem movimentacoes"
              text="As entradas, saidas e ajustes vao aparecer aqui."
            />
          )}
        </div>
      </section>
    </main>
  );
}
