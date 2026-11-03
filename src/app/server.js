import 'dotenv/config';
import app from './app.js';

const PORT = Number.parseInt(process.env.PORT || '3000', 10);

app.listen(PORT, () => {
  console.log(`Servidor Notaire ejecutándose en http://localhost:${PORT}`);
});
