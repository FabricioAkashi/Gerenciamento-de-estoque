import { describe, it, mock, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import movimentacoesRouter from '../src/routes/movimentacoes.js';
import { Produto } from '../src/models/Produto.js';
import { Movimentacao } from '../src/models/Movimentacao.js';
import { AlertaEstoque } from '../src/models/AlertaEstoque.js';
import { errorHandler } from '../src/middleware/errorHandler.js';
import { invokeApp } from './helpers/invokeApp.js';

async function fazerRequisicao(payload, usuario = { nome: 'Operador Teste', papel: 'operador' }) {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.user = usuario;
    next();
  });
  app.use('/api/movimentacoes', movimentacoesRouter);
  app.use(errorHandler);

  return invokeApp(app, {
    method: 'POST',
    url: '/api/movimentacoes',
    body: payload
  });
}

describe('Rotas de Movimentacoes e Concorrencia Atomica (movimentacoes.js)', () => {
  afterEach(() => {
    mock.restoreAll();
  });

  it('deve rejeitar tipo de movimentacao invalido com HTTP 400', async () => {
    const { status, body } = await fazerRequisicao({
      produto: 'prod-1',
      tipo: 'transferencia',
      quantidade: 2
    });

    assert.equal(status, 400);
    assert.equal(body.message, 'Tipo de movimentacao invalido.');
  });

  it('deve rejeitar quantidade menor ou igual a zero com HTTP 400', async () => {
    const resZero = await fazerRequisicao({ produto: 'prod-1', tipo: 'saida', quantidade: 0 });
    const resNeg = await fazerRequisicao({ produto: 'prod-1', tipo: 'entrada', quantidade: -5 });
    const resNaN = await fazerRequisicao({ produto: 'prod-1', tipo: 'saida', quantidade: 'abc' });

    assert.equal(resZero.status, 400);
    assert.equal(resNeg.status, 400);
    assert.equal(resNaN.status, 400);
  });

  it('deve executar saida atomica condicional com $gte e $inc e registrar movimentacao', async () => {
    const produtoAtualizado = {
      _id: '507f1f77bcf86cd799439011',
      nome: 'Pastel de Carne',
      quantidadeAtual: 0,
      estoqueMinimo: 2,
      ativo: true
    };

    const findOneAndUpdateMock = mock.method(Produto, 'findOneAndUpdate', async () => produtoAtualizado);
    mock.method(AlertaEstoque, 'findOneAndUpdate', async () => ({}));
    mock.method(Movimentacao, 'create', async (dados) => ({ _id: 'mov-1', ...dados }));
    mock.method(Movimentacao, 'findById', () => ({
      populate: async () => ({
        _id: 'mov-1',
        tipo: 'saida',
        quantidade: 1,
        produto: produtoAtualizado
      })
    }));

    const { status, body } = await fazerRequisicao({
      produto: '507f1f77bcf86cd799439011',
      tipo: 'saida',
      quantidade: 1,
      observacao: 'Venda balcao'
    });

    assert.equal(status, 201);
    assert.equal(body.tipo, 'saida');
    assert.equal(body.quantidade, 1);

    assert.equal(findOneAndUpdateMock.mock.callCount(), 1);
    const [filtro, atualizacao, opcoes] = findOneAndUpdateMock.mock.calls[0].arguments;
    assert.deepEqual(filtro, {
      _id: '507f1f77bcf86cd799439011',
      ativo: true,
      quantidadeAtual: { $gte: 1 }
    });
    assert.deepEqual(atualizacao, { $inc: { quantidadeAtual: -1 } });
    assert.deepEqual(opcoes, { new: true });
  });

  it('deve impedir condicao de corrida (saldo insuficiente) retornando HTTP 400 sem criar movimentacao', async () => {
    mock.method(Produto, 'findOneAndUpdate', async () => null);
    mock.method(Produto, 'findById', async () => ({
      _id: '507f1f77bcf86cd799439011',
      nome: 'Pastel de Carne',
      quantidadeAtual: 0,
      ativo: true
    }));
    const createMovMock = mock.method(Movimentacao, 'create', async () => ({}));

    const { status, body } = await fazerRequisicao({
      produto: '507f1f77bcf86cd799439011',
      tipo: 'saida',
      quantidade: 1
    });

    assert.equal(status, 400);
    assert.match(body.message, /Quantidade insuficiente em estoque\. Saldo disponivel: 0/);
    assert.equal(createMovMock.mock.callCount(), 0);
  });

  it('deve retornar HTTP 404 na saida quando produto nao existe ou esta inativo', async () => {
    mock.method(Produto, 'findOneAndUpdate', async () => null);
    mock.method(Produto, 'findById', async () => null);

    const { status, body } = await fazerRequisicao({
      produto: '507f1f77bcf86cd799439099',
      tipo: 'saida',
      quantidade: 1
    });

    assert.equal(status, 404);
    assert.equal(body.message, 'Produto nao encontrado ou inativo.');
  });

  it('deve executar entrada atomica com $inc positivo e resolver alerta se acima do minimo', async () => {
    const produtoAtualizado = {
      _id: '507f1f77bcf86cd799439011',
      nome: 'Refrigerante',
      quantidadeAtual: 20,
      estoqueMinimo: 5,
      ativo: true
    };

    const findOneAndUpdateMock = mock.method(Produto, 'findOneAndUpdate', async () => produtoAtualizado);
    const resolveAlertaMock = mock.method(AlertaEstoque, 'updateMany', async () => ({ modifiedCount: 1 }));
    mock.method(Movimentacao, 'create', async (dados) => ({ _id: 'mov-2', ...dados }));
    mock.method(Movimentacao, 'findById', () => ({
      populate: async () => ({ _id: 'mov-2', tipo: 'entrada', quantidade: 10, produto: produtoAtualizado })
    }));

    const { status } = await fazerRequisicao({
      produto: '507f1f77bcf86cd799439011',
      tipo: 'entrada',
      quantidade: 10
    });

    assert.equal(status, 201);
    const [filtro, atualizacao] = findOneAndUpdateMock.mock.calls[0].arguments;
    assert.deepEqual(filtro, { _id: '507f1f77bcf86cd799439011', ativo: true });
    assert.deepEqual(atualizacao, { $inc: { quantidadeAtual: 10 } });
    assert.equal(resolveAlertaMock.mock.callCount(), 1);
  });

  it('deve executar transacao compensatoria (estorno) se Movimentacao.create falhar apos saida', async () => {
    const produtoAtualizado = {
      _id: '507f1f77bcf86cd799439011',
      nome: 'Pastel de Carne',
      quantidadeAtual: 4,
      estoqueMinimo: 2,
      ativo: true
    };

    mock.method(Produto, 'findOneAndUpdate', async () => produtoAtualizado);
    mock.method(AlertaEstoque, 'updateMany', async () => ({}));
    mock.method(Movimentacao, 'create', async () => {
      throw new Error('Falha simulada ao gravar historico');
    });
    const rollbackMock = mock.method(Produto, 'findByIdAndUpdate', async () => produtoAtualizado);

    const { status } = await fazerRequisicao({
      produto: '507f1f77bcf86cd799439011',
      tipo: 'saida',
      quantidade: 3
    });

    assert.equal(status, 500);
    assert.equal(rollbackMock.mock.callCount(), 1);
    const [idEstorno, updateEstorno] = rollbackMock.mock.calls[0].arguments;
    assert.equal(idEstorno, '507f1f77bcf86cd799439011');
    assert.deepEqual(updateEstorno, { $inc: { quantidadeAtual: 3 } });
  });
});
