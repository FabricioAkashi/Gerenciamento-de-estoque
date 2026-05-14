import 'dotenv/config';
import { connectDatabase } from './config/database.js';
import { createApp } from './app.js';

const port = process.env.PORT || 4000;

try {
  await connectDatabase(process.env.MONGODB_URI);
  const app = createApp();

  app.listen(port, () => {
    console.log(`API rodando em http://localhost:${port}/api`);
  });
} catch (error) {
  console.error('Falha ao iniciar servidor:', error.message);
  process.exit(1);
}
