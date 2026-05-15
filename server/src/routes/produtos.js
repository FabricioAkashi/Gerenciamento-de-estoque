import { Router } from 'express';
import { AlertaEstoque } from '../models/AlertaEstoque.js';
import { requireAdmin } from '../middleware/auth.js';
import { Produto } from '../models/Produto.js';

const router = Router();

async function sincronizarAlerta(produto) {
  const emAlerta = produto.quantidadeAtual <= produto.estoqueMinimo;

  if (emAlerta) {
    await AlertaEstoque.findOneAndUpdate(
      { produto: produto._id, status: 'aberto' },
      {
        produto: produto._id,
        status: 'aberto',
        mensagem: `${produto.nome} esta abaixo ou igual ao estoque minimo.`
      },
      { upsert: true, new: true }
    );
    return;
  }

  await AlertaEstoque.updateMany(
    { produto: produto._id, status: 'aberto' },
    { status: 'resolvido' }
  );
}

router.get('/', async (req, res, next) => {
  try {
    const filtro = { ativo: true };

    if (req.query.alerta === 'true') {
      filtro.$expr = { $lte: ['$quantidadeAtual', '$estoqueMinimo'] };
    }

    const produtos = await Produto.find(filtro)
      .populate('categoria fornecedor')
      .sort({ nome: 1 });

    res.json(produtos);
  } catch (error) {
    next(error);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const produto = await Produto.findById(req.params.id).populate('categoria fornecedor');

    if (!produto) {
      return res.status(404).json({ message: 'Produto nao encontrado' });
    }

    res.json(produto);
  } catch (error) {
    next(error);
  }
});

router.post('/', requireAdmin, async (req, res, next) => {
  try {
    const produto = await Produto.create(req.body);
    await sincronizarAlerta(produto);

    const produtoCompleto = await Produto.findById(produto._id).populate('categoria fornecedor');
    res.status(201).json(produtoCompleto);
  } catch (error) {
    next(error);
  }
});

router.put('/:id', requireAdmin, async (req, res, next) => {
  try {
    const produto = await Produto.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true
    });

    if (!produto) {
      return res.status(404).json({ message: 'Produto nao encontrado' });
    }

    await sincronizarAlerta(produto);
    const produtoCompleto = await Produto.findById(produto._id).populate('categoria fornecedor');
    res.json(produtoCompleto);
  } catch (error) {
    next(error);
  }
});

router.delete('/:id', requireAdmin, async (req, res, next) => {
  try {
    const produto = await Produto.findByIdAndUpdate(
      req.params.id,
      { ativo: false },
      { new: true }
    );

    if (!produto) {
      return res.status(404).json({ message: 'Produto nao encontrado' });
    }

    res.json(produto);
  } catch (error) {
    next(error);
  }
});

export { sincronizarAlerta };
export default router;
