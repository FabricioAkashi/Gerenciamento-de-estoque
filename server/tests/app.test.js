import { describe, it, mock, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/app.js';
import { Usuario } from '../src/models/Usuario.js';
import { Produto } from '../src/models/Produto.js';
import { criarToken } from '../src/utils/security.js';
import { invokeApp } from './helpers/invokeApp.js';

describe('Integracao da Aplicacao Express (app.js)', () => {
  afterEach(() => {
    mock.restoreAll();
  });

  it('GET /api/health deve responder HTTP 200 com status ok sem autenticacao', async () => {
    const app = createApp();
    const { status, body } = await invokeApp(app, { method: 'GET', url: '/api/health' });

    assert.equal(status, 200);
    assert.deepEqual(body, { status: 'ok' });
  });

  it('rotas protegidas devem exigir autenticacao (HTTP 401)', async () => {
    const app = createApp();
    const rotasProtegidas = [
      '/api/dashboard',
      '/api/produtos',
      '/api/categorias',
      '/api/fornecedores',
      '/api/movimentacoes',
      '/api/alertas'
    ];

    for (const rota of rotasProtegidas) {
      const { status } = await invokeApp(app, { method: 'GET', url: rota });
      assert.equal(status, 401, `Rota ${rota} deveria exigir autenticacao`);
    }
  });

  it('deve permitir acesso autenticado a /api/produtos e retornar lista JSON', async () => {
    const usuario = { _id: 'user-1', nome: 'Operador', papel: 'operador', ativo: true };
    const token = criarToken(usuario);

    mock.method(Usuario, 'findById', async () => usuario);
    mock.method(Produto, 'find', () => ({
      populate: () => ({
        sort: async () => [{ _id: 'p1', nome: 'Pao de Queijo', quantidadeAtual: 15 }]
      })
    }));

    const app = createApp();
    const { status, body } = await invokeApp(app, {
      method: 'GET',
      url: '/api/produtos',
      headers: { Authorization: `Bearer ${token}` }
    });

    assert.equal(status, 200);
    assert.equal(Array.isArray(body), true);
    assert.equal(body[0].nome, 'Pao de Queijo');
  });

  it('deve retornar HTTP 404 JSON para rotas inexistentes em /api/*', async () => {
    const app = createApp();
    const { status, body } = await invokeApp(app, {
      method: 'GET',
      url: '/api/rota-que-nao-existe'
    });

    assert.equal(status, 404);
    assert.ok(body.message);
  });
});
