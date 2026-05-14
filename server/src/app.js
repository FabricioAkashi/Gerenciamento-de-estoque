import cors from 'cors';
import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import morgan from 'morgan';
import alertasRouter from './routes/alertas.js';
import categoriasRouter from './routes/categorias.js';
import dashboardRouter from './routes/dashboard.js';
import fornecedoresRouter from './routes/fornecedores.js';
import movimentacoesRouter from './routes/movimentacoes.js';
import produtosRouter from './routes/produtos.js';
import { errorHandler, notFound } from './middleware/errorHandler.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const clientDistPath = path.resolve(__dirname, '../../client/dist');

export function createApp() {
  const app = express();

  app.use(
    cors({
      origin: process.env.CLIENT_ORIGIN || 'http://localhost:5173'
    })
  );
  app.use(express.json());
  app.use(morgan('dev'));

  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok' });
  });

  app.use('/api/dashboard', dashboardRouter);
  app.use('/api/produtos', produtosRouter);
  app.use('/api/categorias', categoriasRouter);
  app.use('/api/fornecedores', fornecedoresRouter);
  app.use('/api/movimentacoes', movimentacoesRouter);
  app.use('/api/alertas', alertasRouter);

  app.use(express.static(clientDistPath));

  app.get('*', (req, res, next) => {
    if (req.originalUrl.startsWith('/api')) {
      return next();
    }

    res.sendFile(path.join(clientDistPath, 'index.html'));
  });

  app.use(notFound);
  app.use(errorHandler);

  return app;
}
