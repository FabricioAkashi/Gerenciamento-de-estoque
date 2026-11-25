import { describe, it, mock, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import authRouter, {
  DIAS_REMOCAO_INATIVO,
  limparUsuariosInativosExpirados
} from '../src/routes/auth.js';
import { Usuario } from '../src/models/Usuario.js';
import { criarToken } from '../src/utils/security.js';
import { errorHandler } from '../src/middleware/errorHandler.js';
import { invokeApp } from './helpers/invokeApp.js';

const adminTokenFallbackSecret = 'segredo-teste-estoque-32-caracteres-ok';

function montarAppAuth() {
  const app = express();
  app.use(express.json());
  app.use('/api/auth', authRouter);
  app.use(errorHandler);
  return app;
}

describe('Limpeza automatica de usuarios inativos (auth.js + Usuario.js)', () => {
  afterEach(() => {
    mock.restoreAll();
  });

  it('deve consultar exclusao apenas de contas inativas ha 60 dias ou mais', async () => {
    assert.equal(DIAS_REMOCAO_INATIVO, 60);
    let filtroRecebido = null;

    mock.method(Usuario, 'countDocuments', async () => 1);
    mock.method(Usuario, 'deleteMany', async (filtro) => {
      filtroRecebido = filtro;
      return { deletedCount: 2 };
    });

    const agora = new Date('2026-11-25T12:00:00.000Z');
    const removidos = await limparUsuariosInativosExpirados(agora);

    assert.equal(removidos, 2);
    assert.equal(filtroRecebido.ativo, false);
    assert.equal(filtroRecebido.papel, undefined);

    const limiteEsperado = new Date(agora.getTime() - 60 * 24 * 60 * 60 * 1000);
    assert.equal(filtroRecebido.$or[0].inativadoEm.$lte.getTime(), limiteEsperado.getTime());
    assert.equal(filtroRecebido.$or[1].inativadoEm, null);
    assert.equal(filtroRecebido.$or[1].updatedAt.$lte.getTime(), limiteEsperado.getTime());
  });

  it('deve proteger contas admin caso nao exista nenhum administrador ativo no banco', async () => {
    let filtroRecebido = null;

    mock.method(Usuario, 'countDocuments', async () => 0);
    mock.method(Usuario, 'deleteMany', async (filtro) => {
      filtroRecebido = filtro;
      return { deletedCount: 0 };
    });

    await limparUsuariosInativosExpirados(new Date('2026-11-25T12:00:00.000Z'));

    assert.deepEqual(filtroRecebido.papel, { $ne: 'admin' });
  });

  it('deve preencher inativadoEm ao inativar e limpar ao reativar em PUT /api/auth/usuarios/:id', async () => {
    process.env.JWT_SECRET ||= adminTokenFallbackSecret;

    const adminLogado = {
      _id: 'admin-1',
      nome: 'Admin',
      email: 'admin@teste.local',
      papel: 'admin',
      ativo: true,
      validarSenha: async (senha) => senha === 'SenhaAdmin123'
    };
    const token = criarToken(adminLogado);

    const usuarioAlvo = new Usuario({
      _id: 'op-1',
      nome: 'Operador Um',
      email: 'op1@teste.local',
      papel: 'operador',
      ativo: true,
      inativadoEm: null
    });
    usuarioAlvo.save = async () => usuarioAlvo;

    mock.method(Usuario, 'findById', async (id) => {
      if (id === 'admin-1') return adminLogado;
      if (id === 'op-1') return usuarioAlvo;
      return null;
    });

    const app = montarAppAuth();

    const resInativar = await invokeApp(app, {
      method: 'PUT',
      url: '/api/auth/usuarios/op-1',
      headers: { authorization: `Bearer ${token}` },
      body: { ativo: false, senhaConfirmacao: 'SenhaAdmin123' }
    });

    assert.equal(resInativar.status, 200);
    assert.equal(resInativar.body.ativo, false);
    assert.ok(resInativar.body.inativadoEm);

    const resReativar = await invokeApp(app, {
      method: 'PUT',
      url: '/api/auth/usuarios/op-1',
      headers: { authorization: `Bearer ${token}` },
      body: { ativo: true, senhaConfirmacao: 'SenhaAdmin123' }
    });

    assert.equal(resReativar.status, 200);
    assert.equal(resReativar.body.ativo, true);
    assert.equal(resReativar.body.inativadoEm, null);
  });

  it('deve executar limpeza automatica antes de listar usuarios em GET /api/auth/usuarios', async () => {
    process.env.JWT_SECRET ||= adminTokenFallbackSecret;

    let limpezaExecutada = false;
    const adminLogado = {
      _id: 'admin-1',
      nome: 'Admin',
      email: 'admin@teste.local',
      papel: 'admin',
      ativo: true
    };
    const usuarioInativo = new Usuario({
      _id: 'op-2',
      nome: 'Operador Antigo',
      email: 'op2@teste.local',
      papel: 'operador',
      ativo: false,
      inativadoEm: new Date('2026-11-10T12:00:00.000Z')
    });

    mock.method(Usuario, 'findById', async () => adminLogado);
    mock.method(Usuario, 'countDocuments', async () => 1);
    mock.method(Usuario, 'deleteMany', async () => {
      limpezaExecutada = true;
      return { deletedCount: 1 };
    });
    mock.method(Usuario, 'find', () => ({
      sort: async () => [usuarioInativo]
    }));

    const app = montarAppAuth();
    const token = criarToken(adminLogado);

    const { status, body } = await invokeApp(app, {
      method: 'GET',
      url: '/api/auth/usuarios',
      headers: { authorization: `Bearer ${token}` }
    });

    assert.equal(status, 200);
    assert.equal(limpezaExecutada, true);
    assert.equal(body.length, 1);
    assert.equal(body[0].ativo, false);
    assert.ok(body[0].inativadoEm);
  });
});
