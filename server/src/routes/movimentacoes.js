import { Router } from 'express';
import { Movimentacao } from '../models/Movimentacao.js';
import { Produto } from '../models/Produto.js';
import { sincronizarAlerta } from './produtos.js';

const router = Router();

router.get('/', async (req, res, next) => {
  try {
    const limit = Math.min(Math.max(Number(req.query.limit) || 100, 1), 500);
    const movimentacoes = await Movimentacao.find()
      .populate({
        path: 'produto',
        populate: ['categoria', 'fornecedor']
      })
      .sort({ createdAt: -1 })
      .limit(limit);

    res.json(movimentacoes);
  } catch (error) {
    next(error);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const { produto: produtoId, tipo, quantidade, observacao } = req.body;

    if (!['entrada', 'saida', 'ajuste'].includes(tipo)) {
      return res.status(400).json({ message: 'Tipo de movimentacao invalido.' });
    }

    const qtdNumero = Number(quantidade);
    if (!Number.isFinite(qtdNumero) || qtdNumero <= 0) {
      return res.status(400).json({ message: 'A quantidade deve ser um numero maior que zero.' });
    }

    const produto = await Produto.findById(produtoId);

    if (!produto || !produto.ativo) {
      return res.status(404).json({ message: 'Produto nao encontrado ou inativo.' });
    }

    if (tipo === 'entrada') {
      produto.quantidadeAtual += qtdNumero;
    }

    if (tipo === 'saida') {
      if (produto.quantidadeAtual < qtdNumero) {
        return res.status(400).json({ message: 'Quantidade insuficiente em estoque.' });
      }

      produto.quantidadeAtual -= qtdNumero;
    }

    if (tipo === 'ajuste') {
      produto.quantidadeAtual = qtdNumero;
    }

    await produto.save();
    await sincronizarAlerta(produto);

    const movimentacaoCriada = await Movimentacao.create({
      produto: produto._id,
      tipo,
      quantidade: qtdNumero,
      usuario: req.user?.nome || 'Sistema',
      observacao: String(observacao || '').trim()
    });

    const movimentacao = await Movimentacao.findById(movimentacaoCriada._id).populate('produto');

    res.status(201).json(movimentacao);
  } catch (error) {
    next(error);
  }
});

export default router;
