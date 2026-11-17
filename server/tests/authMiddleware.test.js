import { describe, it, mock, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { requireAuth, requireAdmin } from '../src/middleware/auth.js';
import { Usuario } from '../src/models/Usuario.js';
import { criarToken } from '../src/utils/security.js';

function criarResMock() {
  return {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(data) {
      this.body = data;
      return this;
    }
  };
}

describe('Middlewares de Autenticacao e Autorizacao (auth.js)', () => {
  afterEach(() => {
    mock.restoreAll();
  });

  describe('requireAdmin', () => {
    it('deve permitir acesso quando req.user.papel === "admin"', () => {
      const req = { user: { papel: 'admin', nome: 'Gerente' } };
      const res = criarResMock();
      let nextChamado = false;

      requireAdmin(req, res, () => {
        nextChamado = true;
      });

      assert.equal(nextChamado, true);
      assert.equal(res.statusCode, 200);
    });

    it('deve bloquear operador com HTTP 403', () => {
      const req = { user: { papel: 'operador', nome: 'Balconista' } };
      const res = criarResMock();
      let nextChamado = false;

      requireAdmin(req, res, () => {
        nextChamado = true;
      });

      assert.equal(nextChamado, false);
      assert.equal(res.statusCode, 403);
      assert.match(res.body.message, /Apenas administradores/);
    });

    it('deve bloquear requisicao sem req.user com HTTP 403', () => {
      const req = {};
      const res = criarResMock();
      let nextChamado = false;

      requireAdmin(req, res, () => {
        nextChamado = true;
      });

      assert.equal(nextChamado, false);
      assert.equal(res.statusCode, 403);
    });
  });

  describe('requireAuth', () => {
    it('deve retornar HTTP 401 quando header Authorization estiver ausente', async () => {
      const req = { headers: {} };
      const res = criarResMock();
      let nextChamado = false;

      await requireAuth(req, res, () => {
        nextChamado = true;
      });

      assert.equal(nextChamado, false);
      assert.equal(res.statusCode, 401);
      assert.equal(res.body.message, 'Login necessario.');
    });

    it('deve retornar HTTP 401 quando token for invalido', async () => {
      const req = { headers: { authorization: 'Bearer token.invalido.aqui' } };
      const res = criarResMock();
      let nextChamado = false;

      await requireAuth(req, res, () => {
        nextChamado = true;
      });

      assert.equal(nextChamado, false);
      assert.equal(res.statusCode, 401);
      assert.equal(res.body.message, 'Login necessario.');
    });

    it('deve retornar HTTP 401 quando usuario nao existir ou estiver inativo', async () => {
      const token = criarToken({ _id: '507f1f77bcf86cd799439011', papel: 'operador', nome: 'Op' });
      mock.method(Usuario, 'findById', async () => ({
        _id: '507f1f77bcf86cd799439011',
        papel: 'operador',
        ativo: false
      }));

      const req = { headers: { authorization: `Bearer ${token}` } };
      const res = criarResMock();
      let nextChamado = false;

      await requireAuth(req, res, () => {
        nextChamado = true;
      });

      assert.equal(nextChamado, false);
      assert.equal(res.statusCode, 401);
      assert.equal(res.body.message, 'Usuario invalido ou inativo.');
    });

    it('deve anexar usuario em req.user e chamar next() para token valido e usuario ativo', async () => {
      const usuarioAtivo = {
        _id: '507f1f77bcf86cd799439011',
        nome: 'Operador Caixa',
        papel: 'operador',
        ativo: true
      };
      const token = criarToken(usuarioAtivo);
      mock.method(Usuario, 'findById', async () => usuarioAtivo);

      const req = { headers: { authorization: `Bearer ${token}` } };
      const res = criarResMock();
      let nextChamado = false;

      await requireAuth(req, res, () => {
        nextChamado = true;
      });

      assert.equal(nextChamado, true);
      assert.deepEqual(req.user, usuarioAtivo);
    });
  });
});
