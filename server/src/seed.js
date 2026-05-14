import 'dotenv/config';
import { connectDatabase } from './config/database.js';
import { AlertaEstoque } from './models/AlertaEstoque.js';
import { Categoria } from './models/Categoria.js';
import { Fornecedor } from './models/Fornecedor.js';
import { Movimentacao } from './models/Movimentacao.js';
import { Produto } from './models/Produto.js';
import { sincronizarAlerta } from './routes/produtos.js';

const categorias = [
  { nome: 'Carnes', descricao: 'Proteinas para chapa e preparo.' },
  { nome: 'Bebidas', descricao: 'Refrigerantes, sucos e agua.' },
  { nome: 'Paes', descricao: 'Paes de hamburguer, hot dog e similares.' },
  { nome: 'Embalagens', descricao: 'Sacos, caixas, guardanapos e copos.' }
];

const fornecedores = [
  {
    nome: 'Distribuidora Central',
    cnpj: '12.345.678/0001-90',
    telefone: '(11) 3333-2222',
    email: 'vendas@central.test',
    endereco: 'Rua das Entregas, 120'
  },
  {
    nome: 'Panificadora Aurora',
    telefone: '(11) 4444-1111',
    email: 'pedidos@aurora.test',
    endereco: 'Avenida do Pao, 45'
  }
];

async function seed() {
  await connectDatabase(process.env.MONGODB_URI);

  await Promise.all([
    Categoria.deleteMany({}),
    Fornecedor.deleteMany({}),
    Produto.deleteMany({}),
    Movimentacao.deleteMany({}),
    AlertaEstoque.deleteMany({})
  ]);

  const categoriasCriadas = await Categoria.insertMany(categorias);
  const fornecedoresCriados = await Fornecedor.insertMany(fornecedores);

  const porCategoria = Object.fromEntries(categoriasCriadas.map((item) => [item.nome, item._id]));
  const porFornecedor = Object.fromEntries(fornecedoresCriados.map((item) => [item.nome, item._id]));

  const produtos = await Produto.insertMany([
    {
      nome: 'Hamburguer bovino 90g',
      categoria: porCategoria.Carnes,
      fornecedor: porFornecedor['Distribuidora Central'],
      quantidadeAtual: 42,
      unidadeMedida: 'un',
      estoqueMinimo: 20,
      precoUnitario: 3.9
    },
    {
      nome: 'Refrigerante lata cola',
      categoria: porCategoria.Bebidas,
      fornecedor: porFornecedor['Distribuidora Central'],
      quantidadeAtual: 18,
      unidadeMedida: 'un',
      estoqueMinimo: 24,
      precoUnitario: 2.85
    },
    {
      nome: 'Pao brioche',
      categoria: porCategoria.Paes,
      fornecedor: porFornecedor['Panificadora Aurora'],
      quantidadeAtual: 65,
      unidadeMedida: 'un',
      estoqueMinimo: 30,
      precoUnitario: 1.25
    },
    {
      nome: 'Caixa para lanche',
      categoria: porCategoria.Embalagens,
      fornecedor: porFornecedor['Distribuidora Central'],
      quantidadeAtual: 12,
      unidadeMedida: 'un',
      estoqueMinimo: 50,
      precoUnitario: 0.58
    }
  ]);

  await Movimentacao.insertMany([
    {
      produto: produtos[0]._id,
      tipo: 'entrada',
      quantidade: 42,
      usuario: 'Gerente',
      observacao: 'Carga inicial'
    },
    {
      produto: produtos[1]._id,
      tipo: 'saida',
      quantidade: 6,
      usuario: 'Balcao',
      observacao: 'Reposicao da geladeira'
    }
  ]);

  await Promise.all(produtos.map((produto) => sincronizarAlerta(produto)));

  console.log('Dados de exemplo criados.');
  process.exit(0);
}

seed().catch((error) => {
  console.error(error);
  process.exit(1);
});
