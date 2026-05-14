import { Router } from 'express';
import { AlertaEstoque } from '../models/AlertaEstoque.js';

const router = Router();

router.get('/', async (req, res, next) => {
  try {
    const status = req.query.status || 'aberto';
    const alertas = await AlertaEstoque.find({ status })
      .populate({
        path: 'produto',
        populate: ['categoria', 'fornecedor']
      })
      .sort({ updatedAt: -1 });

    res.json(alertas);
  } catch (error) {
    next(error);
  }
});

router.patch('/:id/resolver', async (req, res, next) => {
  try {
    const alerta = await AlertaEstoque.findByIdAndUpdate(
      req.params.id,
      { status: 'resolvido' },
      { new: true }
    );

    if (!alerta) {
      return res.status(404).json({ message: 'Alerta nao encontrado' });
    }

    res.json(alerta);
  } catch (error) {
    next(error);
  }
});

export default router;
