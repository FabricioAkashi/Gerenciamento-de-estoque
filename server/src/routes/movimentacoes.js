import { Router } from 'express';
import { Movimentacao } from '../models/Movimentacao.js';
import { Produto } from '../models/Produto.js';
import { sincronizarAlerta } from './produtos.js';

const router = Router();

router.get('/', async (req, res, next) => {
  try {
    const movimentacoes = await Movimentacao.find()
      .populate({
        path: 'produto',
        populate: ['categoria', 'fornecedor']
      })
      .sort({ createdAt: -1 })
      .limit(Number(req.query.limit) || 100);

    res.json(movimentacoes);
  } catch (error) {
    next(error);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const { produto: produtoId, tipo, quantidade } = req.body;
    const produto = await Produto.findById(produtoId);

    if (!produto) {
      return res.status(404).json({ message: 'Produto nao encontrado' });
    }

    if (tipo === 'entrada') {
      produto.quantidadeAtual += quantidade;
    }

    if (tipo === 'saida') {
      if (produto.quantidadeAtual < quantidade) {
        return res.status(400).json({ message: 'Quantidade insuficiente em estoque' });
      }

      produto.quantidadeAtual -= quantidade;
    }

    if (tipo === 'ajuste') {
      produto.quantidadeAtual = quantidade;
    }

    await produto.save();
    await sincronizarAlerta(produto);

    const movimentacaoCriada = await Movimentacao.create(req.body);
    const movimentacao = await Movimentacao.findById(movimentacaoCriada._id).populate('produto');

    res.status(201).json(movimentacao);
  } catch (error) {
    next(error);
  }
});

export default router;
