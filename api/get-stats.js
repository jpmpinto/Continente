import fs from 'fs/promises';
import path from 'path';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const filePath = path.join(process.cwd(), 'data', 'invoices.json');
    const raw = await fs.readFile(filePath, 'utf8');
    const artigos = JSON.parse(raw);

    const stats = {};
    for (const art of artigos) {
      if (!stats[art.nome]) stats[art.nome] = { quantidade: 0, gasto: 0 };
      stats[art.nome].quantidade += 1;
      stats[art.nome].gasto += art.preco;
    }

    const sorted = Object.entries(stats)
      .map(([nome, s]) => ({ nome, ...s }))
      .sort((a, b) => b.gasto - a.gasto);

    res.status(200).json({ stats: sorted });
  } catch (err) {
    res.status(200).json({ stats: [] });
  }
}
