import 'dotenv/config';
import { connectDatabase } from './config/database.js';
import { createApp } from './app.js';
import { limparUsuariosInativosExpirados } from './routes/auth.js';
import { segredoToken } from './utils/security.js';

const port = process.env.PORT || 4000;
const INTERVALO_LIMPEZA_MS = 60 * 60 * 1000;

try {
  segredoToken();
  await connectDatabase(process.env.MONGODB_URI);
  await limparUsuariosInativosExpirados();
  setInterval(() => {
    limparUsuariosInativosExpirados().catch((erro) => {
      console.error('Erro na limpeza automatica de usuarios inativos:', erro.message);
    });
  }, INTERVALO_LIMPEZA_MS).unref();

  const app = createApp();

  app.listen(port, () => {
    console.log(`API rodando em http://localhost:${port}/api`);
  });
} catch (error) {
  console.error('Falha ao iniciar servidor:', error.message);
  process.exit(1);
}
