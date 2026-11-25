import { Router } from 'express';
import { requireAdmin } from '../middleware/auth.js';
import { Fornecedor } from '../models/Fornecedor.js';
import { Produto } from '../models/Produto.js';

const router = Router();

router.get('/', async (req, res, next) => {
  try {
    const fornecedores = await Fornecedor.find().sort({ nome: 1 });
    res.json(fornecedores);
  } catch (error) {
    next(error);
  }
});

router.post('/', requireAdmin, async (req, res, next) => {
  try {
    const fornecedor = await Fornecedor.create(req.body);
    res.status(201).json(fornecedor);
  } catch (error) {
    next(error);
  }
});

router.put('/:id', requireAdmin, async (req, res, next) => {
  try {
    const fornecedor = await Fornecedor.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true
    });

    if (!fornecedor) {
      return res.status(404).json({ message: 'Fornecedor nao encontrado' });
    }

    res.json(fornecedor);
  } catch (error) {
    next(error);
  }
});

router.delete('/:id', requireAdmin, async (req, res, next) => {
  try {
    const possuiProdutoAtivo = await Produto.exists({
      fornecedor: req.params.id,
      ativo: true
    });

    if (possuiProdutoAtivo) {
      return res.status(409).json({
        message: 'Nao e possivel remover um fornecedor com produtos ativos vinculados.'
      });
    }

    const fornecedor = await Fornecedor.findByIdAndDelete(req.params.id);

    if (!fornecedor) {
      return res.status(404).json({ message: 'Fornecedor nao encontrado' });
    }

    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

export default router;
