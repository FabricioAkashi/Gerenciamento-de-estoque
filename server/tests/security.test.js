import { describe, it, mock, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  criarHashSenha,
  verificarSenha,
  criarToken,
  verificarToken,
  segredoToken
} from '../src/utils/security.js';

describe('Utilitarios de Seguranca (security.js)', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
    mock.restoreAll();
  });

  describe('Hash e Verificacao de Senha (PBKDF2)', () => {
    it('deve gerar hash no formato iteracoes:salt:hash e validar senha correta', async () => {
      const hash = await criarHashSenha('SenhaForte@123');
      const partes = hash.split(':');

      assert.equal(partes.length, 3);
      assert.equal(partes[0], '120000');
      assert.equal(partes[1].length, 32); // 16 bytes em hex
      assert.equal(partes[2].length, 128); // 64 bytes em hex

      const valida = await verificarSenha('SenhaForte@123', hash);
      assert.equal(valida, true);
    });

    it('deve gerar salts unicos mesmo para senhas identicas', async () => {
      const hash1 = await criarHashSenha('MesmaSenha123');
      const hash2 = await criarHashSenha('MesmaSenha123');

      assert.notEqual(hash1, hash2);
    });

    it('deve rejeitar senha incorreta', async () => {
      const hash = await criarHashSenha('SenhaCorreta123');
      const valida = await verificarSenha('SenhaErrada123', hash);

      assert.equal(valida, false);
    });

    it('deve retornar false de forma segura para hashes malformados ou vazios', async () => {
      assert.equal(await verificarSenha('123456', ''), false);
      assert.equal(await verificarSenha('123456', null), false);
      assert.equal(await verificarSenha('123456', 'formato-invalido'), false);
      assert.equal(await verificarSenha('123456', '0:salt:hash'), false);
      assert.equal(await verificarSenha('', '120000:abc:def'), false);
    });
  });

  describe('Geracao e Validacao de Token (HMAC-SHA256)', () => {
    it('deve criar token valido e extrair payload autentico', () => {
      process.env.AUTH_SECRET = 'segredo-teste-automatizado-seguro';
      const usuario = {
        _id: '507f1f77bcf86cd799439011',
        papel: 'admin',
        nome: 'Admin Teste'
      };

      const token = criarToken(usuario);
      const payload = verificarToken(token);

      assert.ok(payload);
      assert.equal(payload.sub, '507f1f77bcf86cd799439011');
      assert.equal(payload.papel, 'admin');
      assert.equal(payload.nome, 'Admin Teste');
      assert.ok(payload.exp > Date.now());
    });

    it('deve rejeitar token com assinatura adulterada', () => {
      process.env.AUTH_SECRET = 'segredo-teste-automatizado-seguro';
      const token = criarToken({ _id: '123', papel: 'operador', nome: 'Op' });
      const [corpo, assinatura] = token.split('.');
      const assinaturaAdulterada = `${assinatura.slice(0, -1)}${assinatura.endsWith('a') ? 'b' : 'a'}`;

      assert.equal(verificarToken(`${corpo}.${assinaturaAdulterada}`), null);
    });

    it('deve rejeitar token com payload adulterado (escalacao de privilegio)', () => {
      process.env.AUTH_SECRET = 'segredo-teste-automatizado-seguro';
      const token = criarToken({ _id: '123', papel: 'operador', nome: 'Op' });
      const [, assinatura] = token.split('.');

      const payloadFalso = Buffer.from(
        JSON.stringify({ sub: '123', papel: 'admin', nome: 'Hacker', exp: Date.now() + 60000 })
      ).toString('base64url');

      assert.equal(verificarToken(`${payloadFalso}.${assinatura}`), null);
    });

    it('deve rejeitar token expirado', () => {
      process.env.AUTH_SECRET = 'segredo-teste-automatizado-seguro';
      const agora = Date.now();
      mock.method(Date, 'now', () => agora - 1000 * 60 * 60 * 13); // 13h atras (expira em 12h)

      const tokenExpirado = criarToken({ _id: '123', papel: 'admin', nome: 'Admin' });
      mock.restoreAll();

      assert.equal(verificarToken(tokenExpirado), null);
    });

    it('deve retornar null para tokens malformados ou ausentes', () => {
      assert.equal(verificarToken(null), null);
      assert.equal(verificarToken(''), null);
      assert.equal(verificarToken('token-sem-ponto'), null);
      assert.equal(verificarToken('.assinatura'), null);
    });
  });

  describe('Politica de Segredo (segredoToken)', () => {
    it('deve lancar erro critico em producao sem AUTH_SECRET nem JWT_SECRET', () => {
      process.env.NODE_ENV = 'production';
      delete process.env.AUTH_SECRET;
      delete process.env.JWT_SECRET;

      assert.throws(() => segredoToken(), /Vulnerabilidade critica/);
    });

    it('deve retornar AUTH_SECRET quando configurado', () => {
      process.env.NODE_ENV = 'production';
      process.env.AUTH_SECRET = 'chave-producao-valida';

      assert.equal(segredoToken(), 'chave-producao-valida');
    });
  });
});
