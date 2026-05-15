import crypto from 'node:crypto';

const ITERACOES = 120000;
const TAMANHO_CHAVE = 64;
const DIGEST = 'sha512';
const TOKEN_EXPIRACAO_MS = 1000 * 60 * 60 * 12;

function base64Url(valor) {
  return Buffer.from(valor).toString('base64url');
}

function segredoToken() {
  return process.env.AUTH_SECRET || process.env.JWT_SECRET || 'troque-este-segredo-no-deploy';
}

export function criarHashSenha(senha) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(String(senha), salt, ITERACOES, TAMANHO_CHAVE, DIGEST).toString('hex');
  return `${ITERACOES}:${salt}:${hash}`;
}

export function verificarSenha(senha, senhaHash) {
  if (!senha || !senhaHash) {
    return false;
  }

  const [iteracoes, salt, hashSalvo] = senhaHash.split(':');
  const hash = crypto
    .pbkdf2Sync(String(senha), salt, Number(iteracoes), TAMANHO_CHAVE, DIGEST)
    .toString('hex');

  return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(hashSalvo, 'hex'));
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
  if (!token || !token.includes('.')) {
    return null;
  }

  const [corpo, assinatura] = token.split('.');
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
}