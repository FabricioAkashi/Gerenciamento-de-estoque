import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { requireAdmin, requireAuth } from '../middleware/auth.js';
import { Usuario } from '../models/Usuario.js';
import { criarToken } from '../utils/security.js';

const router = Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Muitas tentativas de login. Aguarde 15 minutos antes de tentar novamente.' }
});

const setupLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Muitas tentativas de inicializacao. Tente mais tarde.' }
});

function validarComplexidadeSenha(senha) {
  if (!senha || typeof senha !== 'string' || senha.length < 8) {
    return 'A senha deve ter pelo menos 8 caracteres.';
  }
  return null;
}

function usuarioSeguro(usuario) {
  return usuario.toSafeJSON();
}

function respostaComToken(res, usuario) {
  res.json({ token: criarToken(usuario), usuario: usuarioSeguro(usuario) });
}

async function existeOutroAdmin(usuarioId) {
  const filtro = { papel: 'admin', ativo: true };

  if (usuarioId) {
    filtro._id = { $ne: usuarioId };
  }

  return (await Usuario.countDocuments(filtro)) > 0;
}

router.get('/status', async (req, res, next) => {
  try {
    const totalUsuarios = await Usuario.countDocuments();
    res.json({ setupNecessario: totalUsuarios === 0 });
  } catch (error) {
    next(error);
  }
});

router.post('/setup', setupLimiter, async (req, res, next) => {
  try {
    const totalUsuarios = await Usuario.countDocuments();

    if (totalUsuarios > 0) {
      return res.status(403).json({ message: 'O administrador inicial ja foi criado.' });
    }

    const { nome, email, senha } = req.body;
    const erroSenha = validarComplexidadeSenha(senha);

    if (!nome || !email || erroSenha) {
      return res.status(400).json({ message: erroSenha || 'Informe nome e email validos.' });
    }

    const usuario = new Usuario({ nome, email, papel: 'admin' });
    await usuario.definirSenha(senha);
    await usuario.save();

    respostaComToken(res, usuario);
  } catch (error) {
    next(error);
  }
});

router.post('/login', loginLimiter, async (req, res, next) => {
  try {
    const { email, senha } = req.body;
    const usuario = await Usuario.findOne({ email: String(email || '').toLowerCase().trim() });

    const senhaCorreta = usuario && usuario.ativo ? await usuario.validarSenha(senha) : false;

    if (!usuario || !usuario.ativo || !senhaCorreta) {
      return res.status(401).json({ message: 'Email ou senha invalidos.' });
    }

    respostaComToken(res, usuario);
  } catch (error) {
    next(error);
  }
});

router.get('/me', requireAuth, async (req, res) => {
  res.json(usuarioSeguro(req.user));
});

router.get('/usuarios', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const usuarios = await Usuario.find().sort({ nome: 1 });
    res.json(usuarios.map(usuarioSeguro));
  } catch (error) {
    next(error);
  }
});

router.post('/usuarios', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const { nome, email, senha, papel = 'operador' } = req.body;
    const erroSenha = validarComplexidadeSenha(senha);

    if (!nome || !email || erroSenha) {
      return res.status(400).json({ message: erroSenha || 'Informe nome e email validos.' });
    }

    const usuario = new Usuario({ nome, email, papel });
    await usuario.definirSenha(senha);
    await usuario.save();

    res.status(201).json(usuarioSeguro(usuario));
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ message: 'Ja existe um usuario com este email.' });
    }

    next(error);
  }
});

router.put('/usuarios/:id', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const { nome, email, senha, papel, ativo, senhaConfirmacao } = req.body;

    const confirmacaoValida = await req.user.validarSenha(senhaConfirmacao);
    if (!confirmacaoValida) {
      return res.status(401).json({ message: 'Confirme com a sua senha de administrador.' });
    }

    const usuario = await Usuario.findById(req.params.id);

    if (!usuario) {
      return res.status(404).json({ message: 'Usuario nao encontrado.' });
    }

    const vaiDeixarSemAdmin =
      usuario.papel === 'admin' &&
      usuario.ativo &&
      (papel === 'operador' || ativo === false) &&
      !(await existeOutroAdmin(usuario._id));

    if (vaiDeixarSemAdmin) {
      return res.status(400).json({ message: 'Mantenha pelo menos um administrador ativo.' });
    }

    if (nome) usuario.nome = nome;
    if (email) usuario.email = email;
    if (papel) usuario.papel = papel;
    if (typeof ativo === 'boolean') usuario.ativo = ativo;
    if (senha) {
      const erroSenha = validarComplexidadeSenha(senha);
      if (erroSenha) {
        return res.status(400).json({ message: erroSenha });
      }
      await usuario.definirSenha(senha);
    }

    await usuario.save();
    res.json(usuarioSeguro(usuario));
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ message: 'Ja existe um usuario com este email.' });
    }

    next(error);
  }
});

export default router;
