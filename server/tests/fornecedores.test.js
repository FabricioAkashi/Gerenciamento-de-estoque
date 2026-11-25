import { describe, it, mock, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import fornecedoresRouter from '../src/routes/fornecedores.js';
import { Fornecedor } from '../src/models/Fornecedor.js';
import { Produto } from '../src/models/Produto.js';
import { errorHandler } from '../src/middleware/errorHandler.js';
import { invokeApp } from './helpers/invokeApp.js';

async function chamarRotaFornecedores(method, path, body = null, papel = 'admin') {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.user = { _id: 'user-1', nome: 'Usuario Teste', papel };
    next();
  });
  app.use('/api/fornecedores', fornecedoresRouter);
  app.use(errorHandler);

  return invokeApp(app, {
    method,
    url: `/api/fornecedores${path}`,
    body
  });
}

describe('Rotas de Fornecedores (fornecedores.js)', () => {
  afterEach(() => {
    mock.restoreAll();
  });

  it('deve bloquear operador (HTTP 403) ao tentar criar, editar ou remover fornecedor', async () => {
    const resPost = await chamarRotaFornecedores('POST', '/', { nome: 'Aurora' }, 'operador');
    const resPut = await chamarRotaFornecedores('PUT', '/123', { nome: 'Aurora' }, 'operador');
    const resDel = await chamarRotaFornecedores('DELETE', '/123', null, 'operador');

    assert.equal(resPost.status, 403);
    assert.equal(resPut.status, 403);
    assert.equal(resDel.status, 403);
  });

  it('deve impedir exclusao (HTTP 409) quando houver produtos ativos vinculados ao fornecedor', async () => {
    let deleteChamado = false;

    mock.method(Produto, 'exists', async (filtro) => {
      assert.deepEqual(filtro, { fornecedor: 'forn-1', ativo: true });
      return { _id: 'prod-ativo-1' };
    });
    mock.method(Fornecedor, 'findByIdAndDelete', async () => {
      deleteChamado = true;
      return null;
    });

    const { status, body } = await chamarRotaFornecedores('DELETE', '/forn-1', null, 'admin');

    assert.equal(status, 409);
    assert.equal(deleteChamado, false);
    assert.match(body.message, /produtos ativos/i);
  });

  it('deve remover fornecedor (HTTP 204) quando nao houver produtos ativos vinculados', async () => {
    mock.method(Produto, 'exists', async () => null);
    mock.method(Fornecedor, 'findByIdAndDelete', async (id) => ({
      _id: id,
      nome: 'Distribuidora Norte'
    }));

    const { status } = await chamarRotaFornecedores('DELETE', '/forn-2', null, 'admin');

    assert.equal(status, 204);
  });

  it('deve retornar HTTP 404 ao tentar remover fornecedor inexistente sem produtos ativos', async () => {
    mock.method(Produto, 'exists', async () => null);
    mock.method(Fornecedor, 'findByIdAndDelete', async () => null);

    const { status, body } = await chamarRotaFornecedores('DELETE', '/forn-999', null, 'admin');

    assert.equal(status, 404);
    assert.match(body.message, /nao encontrado/i);
  });
});
