import crypto from 'node:crypto';

const ITERACOES = 120000;
const TAMANHO_CHAVE = 64;
const DIGEST = 'sha512';
const TOKEN_EXPIRACAO_MS = 1000 * 60 * 60 * 12;

function base64Url(valor) {
  return Buffer.from(valor).toString('base64url');
}

export function segredoToken() {
  const segredo = process.env.AUTH_SECRET || process.env.JWT_SECRET;
  if (!segredo) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error(
        'Vulnerabilidade critica: AUTH_SECRET (ou JWT_SECRET) nao configurada nas variaveis de ambiente em producao.'
      );
    }
    return 'dev-local-secret-do-not-use-in-production';
  }
  return segredo;
}

export async function criarHashSenha(senha) {
  const salt = crypto.randomBytes(16).toString('hex');
  const derivedKey = await new Promise((resolve, reject) => {
    crypto.pbkdf2(String(senha), salt, ITERACOES, TAMANHO_CHAVE, DIGEST, (err, key) => {
      if (err) reject(err);
      else resolve(key);
    });
  });
  return `${ITERACOES}:${salt}:${derivedKey.toString('hex')}`;
}

export async function verificarSenha(senha, senhaHash) {
  if (!senha || !senhaHash || typeof senhaHash !== 'string') {
    return false;
  }

  const partes = senhaHash.split(':');
  if (partes.length !== 3) {
    return false;
  }

  const [iteracoesStr, salt, hashSalvo] = partes;
  const iteracoes = Number(iteracoesStr);

  if (!iteracoes || !salt || !hashSalvo) {
    return false;
  }

  try {
    const derivedKey = await new Promise((resolve, reject) => {
      crypto.pbkdf2(String(senha), salt, iteracoes, TAMANHO_CHAVE, DIGEST, (err, key) => {
        if (err) reject(err);
        else resolve(key);
      });
    });

    const hashBuffer = derivedKey;
    const hashSalvoBuffer = Buffer.from(hashSalvo, 'hex');

    if (hashBuffer.length !== hashSalvoBuffer.length) {
      return false;
    }

    return crypto.timingSafeEqual(hashBuffer, hashSalvoBuffer);
  } catch {
    return false;
  }
}

export function criarToken(usuario) {
  const payload = {
    sub: String(usuario._id),
    papel: usuario.papel,
    nome: usuario.nome,
    exp: Date.now() + TOKEN_EXPIRACAO_MS
  };
  const corpo = base64Url(JSON.stringify(payload));
  const assinatura = crypto.createHmac('sha256', segredoToken()).update(corpo).digest('base64url');
  return `${corpo}.${assinatura}`;
}

export function verificarToken(token) {
  if (!token || typeof token !== 'string' || !token.includes('.')) {
    return null;
  }

  const [corpo, assinatura] = token.split('.');
  if (!corpo || !assinatura) {
    return null;
  }

  try {
    const assinaturaEsperada = crypto.createHmac('sha256', segredoToken()).update(corpo).digest('base64url');

    const assinaturaBuffer = Buffer.from(assinatura);
    const assinaturaEsperadaBuffer = Buffer.from(assinaturaEsperada);

    if (
      assinaturaBuffer.length !== assinaturaEsperadaBuffer.length ||
      !crypto.timingSafeEqual(assinaturaBuffer, assinaturaEsperadaBuffer)
    ) {
      return null;
    }

    const payload = JSON.parse(Buffer.from(corpo, 'base64url').toString('utf8'));

    if (!payload.exp || payload.exp < Date.now()) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}
