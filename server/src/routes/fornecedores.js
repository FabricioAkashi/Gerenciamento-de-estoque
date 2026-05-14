import { Router } from 'express';
import { Fornecedor } from '../models/Fornecedor.js';

const router = Router();

router.get('/', async (req, res, next) => {
  try {
    const fornecedores = await Fornecedor.find().sort({ nome: 1 });
    res.json(fornecedores);
  } catch (error) {
    next(error);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const fornecedor = await Fornecedor.create(req.body);
    res.status(201).json(fornecedor);
  } catch (error) {
    next(error);
  }
});

router.put('/:id', async (req, res, next) => {
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

router.delete('/:id', async (req, res, next) => {
  try {
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
