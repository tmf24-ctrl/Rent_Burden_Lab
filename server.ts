import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Load .env.local
import { config } from 'dotenv';
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
config({ path: join(__dirname, '.env.local') });

const app = express();
app.use(cors());
app.use(express.json());

// Dynamically import the API handler
const crawlModule = await import('./api/crawl.ts');
const crawlHandler = crawlModule.default;

app.get('/api/crawl', async (req, res) => {
  // Wrap Express req/res to match Vercel-like interface
  const vercelReq = {
    method: req.method,
    query: req.query,
  };
  const vercelRes = {
    status: (code) => ({
      json: (body) => res.status(code).json(body),
    }),
    setHeader: (name, value) => res.setHeader(name, value),
    json: (body) => res.json(body),
  };
  await crawlHandler(vercelReq, vercelRes);
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`API server running at http://localhost:${PORT}`);
  console.log(`Claude API key loaded: ${process.env.CLAUDE_API_KEY ? 'YES' : 'NO'}`);
  console.log(`ScrapingBee API key loaded: ${process.env.SCRAPINGBEE_API_KEY ? 'YES' : 'NO'}`);
});
