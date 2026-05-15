import { Router } from 'express';
import { requireAdmin, requireAuth } from '../middleware/auth.js';
import { Usuario } from '../models/Usuario.js';
import { criarToken } from '../utils/security.js';

const router = Router();

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

router.post('/setup', async (req, res, next) => {
  try {
    const totalUsuarios = await Usuario.countDocuments();

    if (totalUsuarios > 0) {
      return res.status(403).json({ message: 'O administrador inicial ja foi criado.' });
    }

    const { nome, email, senha } = req.body;

    if (!nome || !email || !senha || senha.length < 6) {
      return res.status(400).json({ message: 'Informe nome, email e senha com pelo menos 6 caracteres.' });
    }

    const usuario = new Usuario({ nome, email, papel: 'admin' });
    usuario.definirSenha(senha);
    await usuario.save();

    respostaComToken(res, usuario);
  } catch (error) {
    next(error);
  }
});

router.post('/login', async (req, res, next) => {
  try {
    const { email, senha } = req.body;
    const usuario = await Usuario.findOne({ email: String(email || '').toLowerCase().trim() });

    if (!usuario || !usuario.ativo || !usuario.validarSenha(senha)) {
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

    if (!nome || !email || !senha || senha.length < 6) {
      return res.status(400).json({ message: 'Informe nome, email e senha com pelo menos 6 caracteres.' });
    }

    const usuario = new Usuario({ nome, email, papel });
    usuario.definirSenha(senha);
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

    if (!req.user.validarSenha(senhaConfirmacao)) {
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
    if (senha) usuario.definirSenha(senha);

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