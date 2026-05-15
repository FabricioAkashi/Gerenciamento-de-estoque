import { Usuario } from '../models/Usuario.js';
import { verificarToken } from '../utils/security.js';

export async function requireAuth(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    const payload = verificarToken(token);

    if (!payload) {
      return res.status(401).json({ message: 'Login necessario.' });
    }

    const usuario = await Usuario.findById(payload.sub);

    if (!usuario || !usuario.ativo) {
      return res.status(401).json({ message: 'Usuario invalido ou inativo.' });
    }

    req.user = usuario;
    next();
  } catch (error) {
    next(error);
  }
}

export function requireAdmin(req, res, next) {
  if (req.user?.papel !== 'admin') {
    return res.status(403).json({ message: 'Apenas administradores podem fazer esta acao.' });
  }

  next();
}