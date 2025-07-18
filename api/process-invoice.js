import pdf from 'pdf-parse';
import fs from 'fs/promises';
import path from 'path';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { pdfBase64 } = req.body;
    if (!pdfBase64) {
      return res.status(400).json({ error: 'Missing pdfBase64' });
    }

    const buffer = Buffer.from(pdfBase64, 'base64');
    const data = await pdf(buffer);

    const artigos = extrairArtigos(data.text);

    const filePath = path.join(process.cwd(), 'data', 'invoices.json');
    let existing = [];
    try {
      const raw = await fs.readFile(filePath, 'utf8');
      existing = JSON.parse(raw);
    } catch (_) {}
    existing.push(...artigos);
    await fs.mkdir(path.join(process.cwd(), 'data'), { recursive: true });
    await fs.writeFile(filePath, JSON.stringify(existing, null, 2));

    res.status(200).json({ ok: true, artigos });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
}

function extrairArtigos(texto) {
  const linhas = texto.split('\n');
  const artigos = [];
  for (const linha of linhas) {
    const match = linha.match(/^(.+?)\s+(\d+,\d{2})$/);
    if (match) {
      artigos.push({ nome: match[1].trim(), preco: parseFloat(match[2].replace(',', '.')) });
    }
  }
  return artigos;
}
