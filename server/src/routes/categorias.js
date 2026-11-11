import { Router } from 'express';
import { requireAdmin } from '../middleware/auth.js';
import { Categoria } from '../models/Categoria.js';

const router = Router();

router.get('/', async (req, res, next) => {
  try {
    const categorias = await Categoria.find().sort({ nome: 1 });
    res.json(categorias);
  } catch (error) {
    next(error);
  }
});

router.post('/', requireAdmin, async (req, res, next) => {
  try {
    const { nome, descricao } = req.body;
    const categoria = await Categoria.create({
      nome: String(nome || '').trim(),
      descricao: String(descricao || '').trim()
    });
    res.status(201).json(categoria);
  } catch (error) {
    next(error);
  }
});

router.put('/:id', requireAdmin, async (req, res, next) => {
  try {
    const { nome, descricao } = req.body;
    const dados = {};
    if (nome !== undefined) dados.nome = String(nome).trim();
    if (descricao !== undefined) dados.descricao = String(descricao).trim();

    const categoria = await Categoria.findByIdAndUpdate(req.params.id, dados, {
      new: true,
      runValidators: true
    });

    if (!categoria) {
      return res.status(404).json({ message: 'Categoria nao encontrada' });
    }

    res.json(categoria);
  } catch (error) {
    next(error);
  }
});

router.delete('/:id', requireAdmin, async (req, res, next) => {
  try {
    const categoria = await Categoria.findByIdAndDelete(req.params.id);

    if (!categoria) {
      return res.status(404).json({ message: 'Categoria nao encontrada' });
    }

    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

export default router;
