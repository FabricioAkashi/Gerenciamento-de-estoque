import { describe, it, mock, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import produtosRouter, { sincronizarAlerta } from '../src/routes/produtos.js';
import { Produto } from '../src/models/Produto.js';
import { AlertaEstoque } from '../src/models/AlertaEstoque.js';
import { errorHandler } from '../src/middleware/errorHandler.js';
import { invokeApp } from './helpers/invokeApp.js';

async function chamarRotaProdutos(method, path, body = null, papel = 'admin') {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.user = { _id: 'user-1', nome: 'Usuario Teste', papel };
    next();
  });
  app.use('/api/produtos', produtosRouter);
  app.use(errorHandler);

  return invokeApp(app, {
    method,
    url: `/api/produtos${path}`,
    body
  });
}

describe('Rotas de Produtos e Alertas (produtos.js)', () => {
  afterEach(() => {
    mock.restoreAll();
  });

  describe('Controle de Acesso (RBAC)', () => {
    it('deve bloquear operador (HTTP 403) ao tentar criar, editar ou remover produtos', async () => {
      const resPost = await chamarRotaProdutos('POST', '/', { nome: 'Coxinha' }, 'operador');
      const resPut = await chamarRotaProdutos('PUT', '/123', { nome: 'Coxinha' }, 'operador');
      const resDel = await chamarRotaProdutos('DELETE', '/123', null, 'operador');

      assert.equal(resPost.status, 403);
      assert.equal(resPut.status, 403);
      assert.equal(resDel.status, 403);
    });
  });

  describe('Sanitizacao e Protecao contra Mass Assignment', () => {
    it('deve filtrar campos nao permitidos e normalizar valores negativos para 0 ao criar produto', async () => {
      let dadosRecebidos = null;
      const produtoCriado = {
        _id: 'prod-100',
        nome: 'Suco Natural',
        quantidadeAtual: 0,
        estoqueMinimo: 0,
        precoUnitario: 0
      };

      mock.method(Produto, 'create', async (dados) => {
        dadosRecebidos = dados;
        return produtoCriado;
      });
      mock.method(AlertaEstoque, 'findOneAndUpdate', async () => ({}));
      mock.method(Produto, 'findById', () => ({
        populate: async () => produtoCriado
      }));

      const { status } = await chamarRotaProdutos(
        'POST',
        '/',
        {
          nome: '  Suco Natural  ',
          quantidadeAtual: -50,
          estoqueMinimo: -10,
          precoUnitario: -15.5,
          campoMalicioso: 'injetado',
          __v: 99
        },
        'admin'
      );

      assert.equal(status, 201);
      assert.equal(dadosRecebidos.nome, 'Suco Natural');
      assert.equal(dadosRecebidos.quantidadeAtual, 0);
      assert.equal(dadosRecebidos.estoqueMinimo, 0);
      assert.equal(dadosRecebidos.precoUnitario, 0);
      assert.equal(dadosRecebidos.campoMalicioso, undefined);
      assert.equal(dadosRecebidos.__v, undefined);
    });
  });

  describe('Soft Delete', () => {
    it('deve desativar produto (ativo: false) ao inves de apagar registro fisico', async () => {
      const findByIdAndUpdateMock = mock.method(Produto, 'findByIdAndUpdate', async () => ({
        _id: 'prod-1',
        nome: 'Kibe',
        ativo: false
      }));

      const { status, body } = await chamarRotaProdutos('DELETE', '/prod-1', null, 'admin');

      assert.equal(status, 200);
      assert.equal(body.ativo, false);
      const [id, update] = findByIdAndUpdateMock.mock.calls[0].arguments;
      assert.equal(id, 'prod-1');
      assert.deepEqual(update, { ativo: false });
    });
  });

  describe('sincronizarAlerta', () => {
    it('deve abrir alerta quando quantidadeAtual <= estoqueMinimo', async () => {
      const upsertMock = mock.method(AlertaEstoque, 'findOneAndUpdate', async () => ({}));

      await sincronizarAlerta({
        _id: 'prod-1',
        nome: 'Carne Moida',
        quantidadeAtual: 5,
        estoqueMinimo: 5
      });

      assert.equal(upsertMock.mock.callCount(), 1);
      const [filtro, dados] = upsertMock.mock.calls[0].arguments;
      assert.deepEqual(filtro, { produto: 'prod-1', status: 'aberto' });
      assert.equal(dados.status, 'aberto');
      assert.match(dados.mensagem, /Carne Moida/);
    });

    it('deve resolver alertas abertos quando quantidadeAtual > estoqueMinimo', async () => {
      const resolveMock = mock.method(AlertaEstoque, 'updateMany', async () => ({ modifiedCount: 1 }));

      await sincronizarAlerta({
        _id: 'prod-1',
        nome: 'Carne Moida',
        quantidadeAtual: 10,
        estoqueMinimo: 5
      });

      assert.equal(resolveMock.mock.callCount(), 1);
      const [filtro, dados] = resolveMock.mock.calls[0].arguments;
      assert.deepEqual(filtro, { produto: 'prod-1', status: 'aberto' });
      assert.deepEqual(dados, { status: 'resolvido' });
    });
  });
});
