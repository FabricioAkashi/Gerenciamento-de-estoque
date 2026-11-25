import { AlertTriangle, BarChart3, ChevronDown, ChevronUp } from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import React, { useMemo, useState } from 'react';
import { moeda, numero } from '../utils/format.js';
import { ActivityHeatmap } from './arc/activity-heatmap/activity-heatmap.tsx';
import { LineChart } from './arc/line-chart/line-chart.tsx';

const DIAS_HEATMAP = 182;
const UNIDADE_HEATMAP = { one: 'movimentação', other: 'movimentações' };
const SERIES_FLUXO = [
  {
    key: 'entrada',
    label: 'Entradas',
    color: 'var(--chart-in-bg)',
    area: true
  },
  {
    key: 'saida',
    label: 'Saídas',
    color: 'var(--accent-warn)',
    dashed: true,
    area: false
  }
];

function chaveDiaLocal(date) {
  const ano = date.getFullYear();
  const mes = String(date.getMonth() + 1).padStart(2, '0');
  const dia = String(date.getDate()).padStart(2, '0');
  return `${ano}-${mes}-${dia}`;
}

function formatarDiaCurto(date) {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit'
  }).format(date);
}

function formatarDiaCompleto(date) {
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short'
  }).format(date);
}

export function AnalyticsPanel({
  aberto,
  onToggle,
  periodoDias,
  onMudarPeriodo,
  produtos,
  categorias,
  movimentacoes,
  carregando,
  categoriaSelecionada,
  onAlternarCategoria,
  buscaAtiva,
  onSelecionarProduto
}) {
  const [indiceDiaAtivo, setIndiceDiaAtivo] = useState(null);
  const [dataHeatmapSelecionada, setDataHeatmapSelecionada] = useState(null);
  const reducedMotion = Boolean(useReducedMotion());

  const analiseFluxo = useMemo(() => {
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    const dias = [];
    const mapa = new Map();

    for (let offset = periodoDias - 1; offset >= 0; offset -= 1) {
      const data = new Date(hoje);
      data.setDate(hoje.getDate() - offset);
      const chave = chaveDiaLocal(data);
      const bucket = {
        key: chave,
        label: formatarDiaCompleto(data),
        axisLabel: formatarDiaCurto(data),
        values: { entrada: 0, saida: 0 },
        registros: 0
      };
      dias.push(bucket);
      mapa.set(chave, bucket);
    }

    let totalEntradas = 0;
    let totalSaidas = 0;

    for (const item of movimentacoes) {
      if (item.tipo !== 'entrada' && item.tipo !== 'saida') {
        continue;
      }
      const dataItem = new Date(item.createdAt);
      if (Number.isNaN(dataItem.getTime())) {
        continue;
      }
      const bucket = mapa.get(chaveDiaLocal(dataItem));
      if (!bucket) {
        continue;
      }
      const qtd = Number(item.quantidade || 0);
      if (item.tipo === 'entrada') {
        bucket.values.entrada += qtd;
        totalEntradas += qtd;
      } else {
        bucket.values.saida += qtd;
        totalSaidas += qtd;
      }
      bucket.registros += 1;
    }

    return {
      dias,
      totalEntradas,
      totalSaidas
    };
  }, [movimentacoes, periodoDias]);

  const dadosHeatmap = useMemo(() => {
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    const dias = [];
    const detalhesPorDia = new Map();

    for (let offset = DIAS_HEATMAP - 1; offset >= 0; offset -= 1) {
      const data = new Date(hoje);
      data.setDate(hoje.getDate() - offset);
      const chave = chaveDiaLocal(data);
      const entrada = {
        date: chave,
        count: 0,
        rotulo: formatarDiaCompleto(data),
        entrada: 0,
        saida: 0,
        ajuste: 0,
        registros: 0
      };
      dias.push({ date: chave, count: 0 });
      detalhesPorDia.set(chave, entrada);
    }

    const indicesPorChave = new Map(dias.map((item, index) => [item.date, index]));

    for (const item of movimentacoes) {
      const dataItem = new Date(item.createdAt);
      if (Number.isNaN(dataItem.getTime())) {
        continue;
      }
      const chave = chaveDiaLocal(dataItem);
      const idx = indicesPorChave.get(chave);
      if (idx === undefined) {
        continue;
      }
      const qtd = Number(item.quantidade || 0);
      const detalhe = detalhesPorDia.get(chave);
      dias[idx].count += 1;
      detalhe.count += 1;
      detalhe.registros += 1;
      if (item.tipo === 'entrada') detalhe.entrada += qtd;
      else if (item.tipo === 'saida') detalhe.saida += qtd;
      else if (item.tipo === 'ajuste') detalhe.ajuste += qtd;
    }

    return {
      dias,
      detalhesPorDia,
      ultimoDiaComMovimento:
        Array.from(detalhesPorDia.values())
          .reverse()
          .find((item) => item.registros > 0)?.date || null
    };
  }, [movimentacoes]);

  const valorPorCategoria = useMemo(() => {
    const nomesPorId = new Map(categorias.map((cat) => [cat._id, cat.nome]));
    const grupos = new Map();
    let valorTotal = 0;

    for (const item of produtos) {
      const catId = item.categoria?._id || item.categoria || '';
      const chave = catId || 'sem-categoria';
      const nome = item.categoria?.nome || nomesPorId.get(catId) || 'Sem categoria';
      const valorItem = Math.max(0, Number(item.quantidadeAtual || 0) * Number(item.precoUnitario || 0));

      if (!grupos.has(chave)) {
        grupos.set(chave, {
          id: catId,
          chave,
          nome,
          valor: 0,
          itens: 0,
          emAlerta: 0
        });
      }

      const atual = grupos.get(chave);
      atual.valor += valorItem;
      atual.itens += 1;
      if (item.emAlerta) {
        atual.emAlerta += 1;
      }
      valorTotal += valorItem;
    }

    const lista = Array.from(grupos.values()).sort((a, b) => {
      if (b.valor !== a.valor) return b.valor - a.valor;
      if (b.itens !== a.itens) return b.itens - a.itens;
      return a.nome.localeCompare(b.nome, 'pt-BR', { sensitivity: 'base' });
    });

    return {
      lista,
      valorTotal,
      maxValor: Math.max(1, ...lista.map((cat) => cat.valor))
    };
  }, [produtos, categorias]);

  const rankingSaidas = useMemo(() => {
    const inicio = new Date();
    inicio.setHours(0, 0, 0, 0);
    inicio.setDate(inicio.getDate() - (periodoDias - 1));

    const produtosPorId = new Map(produtos.map((item) => [item._id, item]));
    const acumulado = new Map();

    for (const item of movimentacoes) {
      if (item.tipo !== 'saida') {
        continue;
      }
      const dataItem = new Date(item.createdAt);
      if (Number.isNaN(dataItem.getTime()) || dataItem < inicio) {
        continue;
      }

      const prodId = item.produto?._id || item.produto || '';
      const prodAtual = prodId ? produtosPorId.get(prodId) : null;
      const nome = prodAtual?.nome || item.produto?.nome || 'Produto removido';
      const chave = prodId || nome;

      if (!acumulado.has(chave)) {
        acumulado.set(chave, {
          chave,
          id: prodId,
          nome,
          unidade: prodAtual?.unidadeMedida || item.produto?.unidadeMedida || 'un',
          quantidadeSaida: 0,
          movimentos: 0,
          emAlerta: Boolean(prodAtual?.emAlerta),
          ativo: Boolean(prodAtual)
        });
      }

      const atual = acumulado.get(chave);
      atual.quantidadeSaida += Number(item.quantidade || 0);
      atual.movimentos += 1;
    }

    const top = Array.from(acumulado.values())
      .sort((a, b) => b.quantidadeSaida - a.quantidadeSaida)
      .slice(0, 6);

    return {
      top,
      maxQuantidade: Math.max(1, ...top.map((item) => item.quantidadeSaida))
    };
  }, [movimentacoes, periodoDias, produtos]);

  const diaInspecionado =
    indiceDiaAtivo !== null && analiseFluxo.dias[indiceDiaAtivo]
      ? analiseFluxo.dias[indiceDiaAtivo]
      : null;

  const chaveHeatmapExibida = dataHeatmapSelecionada || dadosHeatmap.ultimoDiaComMovimento;
  const detalheHeatmap = chaveHeatmapExibida
    ? dadosHeatmap.detalhesPorDia.get(chaveHeatmapExibida) || null
    : null;

  const temFluxo = analiseFluxo.totalEntradas > 0 || analiseFluxo.totalSaidas > 0;

  return (
    <section aria-label="Análises e indicadores do estoque" className="panel analytics-panel">
      <div className="analytics-header">
        <div className="analytics-heading">
          <button
            aria-controls="bloco-graficos-conteudo"
            aria-expanded={aberto}
            className="analytics-toggle"
            onClick={onToggle}
            type="button"
          >
            <BarChart3 aria-hidden="true" size={18} />
            <span className="analytics-toggle-title">Visão analítica</span>
            <span className="analytics-toggle-meta">
              {periodoDias} dias · {numero(analiseFluxo.totalEntradas)} ent. / {numero(analiseFluxo.totalSaidas)} saí.
            </span>
            {aberto ? (
              <ChevronUp aria-hidden="true" className="analytics-chevron" size={17} />
            ) : (
              <ChevronDown aria-hidden="true" className="analytics-chevron" size={17} />
            )}
          </button>
        </div>

        {aberto && (
          <div aria-label="Período dos gráficos" className="analytics-period-group" role="group">
            {[7, 30].map((dias) => (
              <button
                aria-pressed={periodoDias === dias}
                className={`quick-chip ${periodoDias === dias ? 'active' : ''}`}
                key={dias}
                onClick={() => onMudarPeriodo(dias)}
                type="button"
              >
                {dias} dias
              </button>
            ))}
          </div>
        )}
      </div>

      <AnimatePresence initial={false}>
        {aberto && (
          <motion.div
            animate={{ height: 'auto', opacity: 1 }}
            className="analytics-collapse"
            exit={reducedMotion ? { opacity: 0 } : { height: 0, opacity: 0 }}
            id="bloco-graficos-conteudo"
            initial={reducedMotion ? false : { height: 0, opacity: 0 }}
            transition={{ duration: reducedMotion ? 0 : 0.28, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="analytics-grid">
          <article className="chart-card">
            <div className="chart-card-header">
              <div>
                <h3>Entradas e saídas por dia</h3>
                <p>Evolução diária nos últimos {periodoDias} dias</p>
              </div>
              <div className="chart-totals-inline">
                <span>+{numero(analiseFluxo.totalEntradas)}</span>
                <span>-{numero(analiseFluxo.totalSaidas)}</span>
              </div>
            </div>

            {!temFluxo && !carregando ? (
              <div className="chart-empty">
                <strong>Sem movimentações no período</strong>
                <span>Registre entradas ou saídas para visualizar a curva diária.</span>
              </div>
            ) : (
              <>
                <LineChart
                  categoryLabel="Data"
                  curve="linear"
                  data={temFluxo ? analiseFluxo.dias : []}
                  emptyLabel="Sem dados neste período"
                  formatTick={(valor) => numero(valor)}
                  formatValue={(valor) => `${numero(valor)} un`}
                  height={200}
                  label="Entradas e saídas por dia"
                  loading={carregando}
                  onActiveChange={(index) => setIndiceDiaAtivo(index)}
                  series={SERIES_FLUXO}
                />
                <div aria-live="polite" className="chart-day-inspector">
                  <div className="chart-day-readout">
                    {diaInspecionado ? (
                      <>
                        <strong>{diaInspecionado.label}</strong>
                        <span>
                          +{numero(diaInspecionado.values.entrada)} ent. · -{numero(diaInspecionado.values.saida)} saí.
                        </span>
                      </>
                    ) : (
                      <span>Passe o cursor, toque ou use as setas no gráfico para inspecionar um dia.</span>
                    )}
                  </div>
                </div>
              </>
            )}
          </article>

          <article className="chart-card">
            <div className="chart-card-header">
              <div>
                <h3>Frequência de movimentações</h3>
                <p>Ritmo operacional nas últimas 26 semanas</p>
              </div>
              {dataHeatmapSelecionada && (
                <button
                  className="chart-reset-btn"
                  onClick={() => setDataHeatmapSelecionada(null)}
                  type="button"
                >
                  Limpar
                </button>
              )}
            </div>

            {carregando && movimentacoes.length === 0 ? (
              <div className="loading-state" role="status" aria-live="polite">
                Carregando histórico de atividade...
              </div>
            ) : (
              <>
                <ActivityHeatmap
                  className="heatmap-card-body"
                  days={dadosHeatmap.dias}
                  label="Frequência de movimentações nas últimas 26 semanas"
                  locale="pt-BR"
                  onSelectDate={(data) =>
                    setDataHeatmapSelecionada((atual) => (atual === data ? null : data))
                  }
                  period="26 semanas"
                  selectedDate={dataHeatmapSelecionada}
                  unit={UNIDADE_HEATMAP}
                />

                <div aria-live="polite" className="chart-day-inspector">
                  <div className="chart-day-readout">
                    {detalheHeatmap ? (
                      <>
                        <strong>
                          {dataHeatmapSelecionada ? detalheHeatmap.rotulo : `Último dia ativo (${detalheHeatmap.rotulo})`}
                        </strong>
                        <span>
                          {numero(detalheHeatmap.registros)} reg. · +{numero(detalheHeatmap.entrada)} ent. · -
                          {numero(detalheHeatmap.saida)} saí. · {numero(detalheHeatmap.ajuste)} aj.
                        </span>
                      </>
                    ) : (
                      <span>Nenhuma movimentação registrada nas últimas 26 semanas.</span>
                    )}
                  </div>
                </div>
              </>
            )}
          </article>

          <article className="chart-card">
            <div className="chart-card-header">
              <div>
                <h3>Onde está o valor do estoque</h3>
                <p>Clique em uma categoria para filtrar a tabela de produtos</p>
              </div>
              {categoriaSelecionada && (
                <button
                  className="chart-reset-btn"
                  onClick={() => onAlternarCategoria(categoriaSelecionada)}
                  type="button"
                >
                  Limpar
                </button>
              )}
            </div>

            {carregando && produtos.length === 0 ? (
              <div className="loading-state" role="status" aria-live="polite">
                Carregando categorias...
              </div>
            ) : valorPorCategoria.lista.length === 0 ? (
              <div className="chart-empty">
                <strong>Nenhum produto ativo</strong>
                <span>Cadastre produtos para acompanhar o valor distribuído por categoria.</span>
              </div>
            ) : valorPorCategoria.valorTotal <= 0 ? (
              <div className="chart-empty">
                <strong>Sem valores unitários cadastrados</strong>
                <span>Informe o preço unitário dos produtos para calcular o valor por categoria.</span>
              </div>
            ) : (
              <div className="hbar-list">
                {valorPorCategoria.lista.map((cat) => {
                  const pctTotal =
                    valorPorCategoria.valorTotal > 0
                      ? Math.round((cat.valor / valorPorCategoria.valorTotal) * 100)
                      : 0;
                  const larguraBarra = Math.max((cat.valor / valorPorCategoria.maxValor) * 100, 3);
                  const selecionada = Boolean(cat.id && categoriaSelecionada === cat.id);
                  const subtexto = `${cat.itens} ${cat.itens === 1 ? 'item' : 'itens'}${
                    cat.emAlerta > 0 ? ` · ${cat.emAlerta} em alerta` : ''
                  }`;

                  return (
                    <HorizontalBarItem
                      active={selecionada}
                      key={cat.chave}
                      label={cat.nome}
                      meta={subtexto}
                      onClick={cat.id ? () => onAlternarCategoria(cat.id) : undefined}
                      percent={larguraBarra}
                      subValue={`${pctTotal}%`}
                      value={moeda(cat.valor)}
                    />
                  );
                })}
              </div>
            )}
          </article>

          <article className="chart-card">
            <div className="chart-card-header">
              <div>
                <h3>Produtos com maior saída</h3>
                <p>Itens mais movimentados nos últimos {periodoDias} dias</p>
              </div>
              {buscaAtiva && (
                <button
                  className="chart-reset-btn"
                  onClick={() => onSelecionarProduto('')}
                  type="button"
                >
                  Limpar
                </button>
              )}
            </div>

            {carregando && movimentacoes.length === 0 ? (
              <div className="loading-state" role="status" aria-live="polite">
                Calculando saídas do período...
              </div>
            ) : rankingSaidas.top.length === 0 ? (
              <div className="chart-empty">
                <strong>Nenhuma saída no período</strong>
                <span>As saídas registradas nos últimos {periodoDias} dias aparecerão aqui.</span>
              </div>
            ) : (
              <div className="hbar-list">
                {rankingSaidas.top.map((item) => {
                  const larguraBarra = Math.max(
                    (item.quantidadeSaida / rankingSaidas.maxQuantidade) * 100,
                    5
                  );
                  const selecionado =
                    item.ativo && buscaAtiva.trim().toLowerCase() === item.nome.toLowerCase();

                  return (
                    <HorizontalBarItem
                      active={selecionado}
                      alert={item.ativo && item.emAlerta}
                      key={item.chave}
                      label={item.nome}
                      meta={`${item.movimentos} ${item.movimentos === 1 ? 'saída' : 'saídas'}`}
                      onClick={
                        item.ativo
                          ? () => onSelecionarProduto(selecionado ? '' : item.nome)
                          : undefined
                      }
                      percent={larguraBarra}
                      value={`${numero(item.quantidadeSaida)} ${item.unidade}`}
                    />
                  );
                })}
              </div>
            )}
          </article>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}

function HorizontalBarItem({ label, meta, value, subValue, percent, active = false, alert = false, onClick }) {
  const content = (
    <>
      <div className="hbar-top">
        <span className="hbar-name">
          <strong>
            {label}
            {alert && (
              <span className="hbar-alert-tag">
                <AlertTriangle aria-hidden="true" size={12} />
                Alerta
              </span>
            )}
          </strong>
          <small>{meta}</small>
        </span>
        <span className="hbar-value">
          <strong>{value}</strong>
          {subValue && <small>{subValue}</small>}
        </span>
      </div>
      <div aria-hidden="true" className="hbar-track">
        <span
          className={`hbar-fill ${alert ? 'is-alert' : ''}`}
          style={{ width: `${percent}%` }}
        />
      </div>
    </>
  );

  if (!onClick) {
    return <div className="hbar-row is-static">{content}</div>;
  }

  return (
    <button
      aria-pressed={active}
      className={`hbar-row ${active ? 'active' : ''}`}
      onClick={onClick}
      type="button"
    >
      {content}
    </button>
  );
}
