# Estoque Lanchonete

Aplicacao web com React, Node.js, Express e MongoDB para controlar estoque de uma lanchonete. O fluxo de caixa ainda nao foi implementado conforme planejado.

Login para acesso no deploy:

Login:teste@email.com 

Senha:123456

## Recursos

- Dashboard com total de produtos, itens em alerta, valor estimado em estoque e movimentacoes recentes.
- Cadastro e edicao de produtos, categorias e fornecedores.
- Registro de entradas, saidas e ajustes de estoque.
- Alertas automaticos para produtos abaixo do estoque minimo.
- API REST usando MongoDB via Mongoose.

## Como rodar

1. Instale as dependencias:

```bash
npm install
```

2. Crie `server/.env` a partir de `server/.env.example`.

3. Inicie MongoDB localmente ou configure uma URI do MongoDB Atlas.

4. Rode a aplicacao:

```bash
npm run dev
```

Frontend: http://localhost:5173

API: http://localhost:4000/api

## Dados de exemplo

Depois de configurar o MongoDB, rode:

```bash
npm run seed --workspace server
```

Isso cria categorias, fornecedores, produtos e movimentacoes iniciais para testar o sistema.
