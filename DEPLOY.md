# Deploy

Esta pasta e a versao preparada para deploy. Ela roda a API Node/Express e entrega o frontend React buildado pelo mesmo servidor.

## Configuracao recomendada

Em uma plataforma como Render ou Railway, crie um servico web usando esta pasta como projeto.

### Build command

```bash
npm install && npm run build
```

Alternativa equivalente no Render:

```bash
npm run render-build
```

### Start command

```bash
npm start
```

### Variaveis de ambiente

Configure:

```env
MONGODB_URI=mongodb+srv://usuario:senha@cluster.mongodb.net/estoque_lanchonete?appName=Cluster0
NODE_ENV=production
```

Opcional:

```env
PORT=4000
CLIENT_ORIGIN=https://seu-dominio-do-deploy
```

Em muitas plataformas o `PORT` e definido automaticamente. Nesse caso, nao precisa configurar manualmente.

## Antes de subir

- Confirme que o usuario e senha do MongoDB Atlas estao certos.
- Em Network Access no Atlas, para deploy, libere `0.0.0.0/0` ou siga a faixa de IP recomendada pela plataforma.
- Nao suba o arquivo `.env` com senha para repositorio publico.

## Teste local desta versao

```bash
npm install
npm run build
npm start
```

Depois abra:

```text
http://localhost:4000
```
