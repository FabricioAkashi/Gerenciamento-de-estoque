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

    let produto;

    if (tipo === 'saida') {
      // Operacao Atomica com verificacao condicional no MongoDB (previne Race Condition)
      produto = await Produto.findOneAndUpdate(
        {
          _id: produtoId,
          ativo: true,
          quantidadeAtual: { $gte: qtdNumero }
        },
        {
          $inc: { quantidadeAtual: -qtdNumero }
        },
        { new: true }
      );

      if (!produto) {
        const produtoExistente = await Produto.findById(produtoId);
        if (!produtoExistente || !produtoExistente.ativo) {
          return res.status(404).json({ message: 'Produto nao encontrado ou inativo.' });
        }
        return res.status(400).json({
          message: `Quantidade insuficiente em estoque. Saldo disponivel: ${produtoExistente.quantidadeAtual}.`
        });
      }
    } else if (tipo === 'entrada') {
      produto = await Produto.findOneAndUpdate(
        { _id: produtoId, ativo: true },
        { $inc: { quantidadeAtual: qtdNumero } },
        { new: true }
      );

      if (!produto) {
        return res.status(404).json({ message: 'Produto nao encontrado ou inativo.' });
      }
    } else if (tipo === 'ajuste') {
      produto = await Produto.findOneAndUpdate(
        { _id: produtoId, ativo: true },
        { $set: { quantidadeAtual: qtdNumero } },
        { new: true }
      );

      if (!produto) {
        return res.status(404).json({ message: 'Produto nao encontrado ou inativo.' });
      }
    }

    await sincronizarAlerta(produto);

    try {
      const movimentacaoCriada = await Movimentacao.create({
        produto: produto._id,
        tipo,
        quantidade: qtdNumero,
        usuario: req.user?.nome || 'Sistema',
        observacao: String(observacao || '').trim()
      });

      const movimentacao = await Movimentacao.findById(movimentacaoCriada._id).populate('produto');
      return res.status(201).json(movimentacao);
    } catch (movError) {
      // Compensacao caso a gravacao do historico falhe
      if (tipo === 'saida') {
        await Produto.findByIdAndUpdate(produtoId, { $inc: { quantidadeAtual: qtdNumero } });
      } else if (tipo === 'entrada') {
        await Produto.findByIdAndUpdate(produtoId, { $inc: { quantidadeAtual: -qtdNumero } });
      }
      throw movError;
    }
  } catch (error) {
    next(error);
  }
});

export default router;
