import cors from 'cors';
import express from 'express';
import rateLimit from 'express-rate-limit';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import helmet from 'helmet';
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

  app.set('trust proxy', 1);

  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginResourcePolicy: false,
      crossOriginEmbedderPolicy: false
    })
  );

  const allowedOrigins = process.env.CLIENT_ORIGIN
    ? process.env.CLIENT_ORIGIN.split(',').map((o) => o.trim())
    : ['http://localhost:5173'];

  const corsOptionsDelegate = (req, callback) => {
    const origin = req.headers.origin;
    const host = req.get('host');

    if (!origin) {
      return callback(null, { origin: true, credentials: true });
    }

    if (host && (origin === `http://${host}` || origin === `https://${host}`)) {
      return callback(null, { origin: true, credentials: true });
    }

    if (allowedOrigins.includes(origin)) {
      return callback(null, { origin: true, credentials: true });
    }

    if (
      process.env.NODE_ENV !== 'production' &&
      (origin.includes('localhost') || origin.includes('127.0.0.1'))
    ) {
      return callback(null, { origin: true, credentials: true });
    }

    return callback(null, { origin: false });
  };

  app.use('/api', cors(corsOptionsDelegate));
  app.use(express.json());
  app.use(morgan('dev'));

  const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 300,
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: 'Limite de requisicoes excedido. Aguarde alguns minutos.' }
  });

  app.use('/api', apiLimiter);

  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok' });
  });

  if (process.env.NODE_ENV !== 'production') {
    app.get('/api/deploy-check', (req, res) => {
      res.json({
        status: 'ok',
        clientDistPath,
        indexExists: fs.existsSync(path.join(clientDistPath, 'index.html')),
        nodeEnv: process.env.NODE_ENV || 'development'
      });
    });
  }

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
