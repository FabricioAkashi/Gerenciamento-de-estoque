import cors from 'cors';
import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import morgan from 'morgan';
import { requireAuth } from './middleware/auth.js';
import alertasRouter from './routes/alertas.js';
import authRouter from './routes/auth.js';
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

  const corsOptions =
    process.env.NODE_ENV === 'production'
      ? {}
      : { origin: process.env.CLIENT_ORIGIN || 'http://localhost:5173' };

  app.use(cors(corsOptions));
  app.use(express.json());
  app.use(morgan('dev'));

  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok' });
  });

  app.get('/api/deploy-check', (req, res) => {
    res.json({
      status: 'ok',
      clientDistPath,
      indexExists: fs.existsSync(path.join(clientDistPath, 'index.html')),
      nodeEnv: process.env.NODE_ENV || 'development'
    });
  });

  app.use('/api/auth', authRouter);

  app.use('/api/dashboard', requireAuth, dashboardRouter);
  app.use('/api/produtos', requireAuth, produtosRouter);
  app.use('/api/categorias', requireAuth, categoriasRouter);
  app.use('/api/fornecedores', requireAuth, fornecedoresRouter);
  app.use('/api/movimentacoes', requireAuth, movimentacoesRouter);
  app.use('/api/alertas', requireAuth, alertasRouter);

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
