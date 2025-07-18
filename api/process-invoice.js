const pdf = require('pdf-parse');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', async () => {
      const { pdfBase64 } = JSON.parse(body);

      if (!pdfBase64) {
        res.status(400).json({ error: 'Missing pdfBase64' });
        return;
      }

      const buffer = Buffer.from(pdfBase64, 'base64');
      const data = await pdf(buffer);

      const artigos = extrairArtigos(data.text);
      res.status(200).json({ artigos });
    });
  } catch (err) {
    console.error('Erro ao processar PDF', err);
    res.status(500).json({ error: err.message });
  }
};

function extrairArtigos(texto) {
  const linhas = texto.split('\n');
  const artigos = [];
  for (const linha of linhas) {
    const match = linha.match(/^(.+?)\s+(\d+,\d{2})$/);
    if (match) {
      artigos.push({
        nome: match[1].trim(),
        preco: parseFloat(match[2].replace(',', '.'))
      });
    }
  }
  return artigos;
}
