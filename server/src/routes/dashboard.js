import { Router } from 'express';
import { Movimentacao } from '../models/Movimentacao.js';
import { Produto } from '../models/Produto.js';

const router = Router();

router.get('/', async (req, res, next) => {
  try {
    const [produtos, movimentacoesRecentes] = await Promise.all([
      Produto.find({ ativo: true }).populate('categoria fornecedor').sort({ nome: 1 }),
      Movimentacao.find()
        .populate('produto')
        .sort({ createdAt: -1 })
        .limit(6)
    ]);

    const produtosEmAlerta = produtos.filter(
      (produto) => produto.quantidadeAtual <= produto.estoqueMinimo
    );

    const valorEstoque = produtos.reduce(
      (total, produto) => total + produto.quantidadeAtual * produto.precoUnitario,
      0
    );

    res.json({
      totais: {
        produtos: produtos.length,
        produtosEmAlerta: produtosEmAlerta.length,
        valorEstoque,
        itensEmEstoque: produtos.reduce((total, produto) => total + produto.quantidadeAtual, 0)
      },
      produtosEmAlerta,
      movimentacoesRecentes
    });
  } catch (error) {
    next(error);
  }
});

export default router;
