import pdf from 'pdf-parse';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { pdfBase64 } = req.body;
    if (!pdfBase64) {
      return res.status(400).json({ error: 'Missing pdfBase64 in body' });
    }

    const dataBuffer = Buffer.from(pdfBase64, 'base64');
    const data = await pdf(dataBuffer);

    const lines = data.text.split('\n').map(l => l.trim()).filter(Boolean);

    // Extrair data e total (tentativa)
    const dateMatch = data.text.match(/\d{2}\/\d{2}\/\d{4}/);
    const invoiceDate = dateMatch ? dateMatch[0] : '';

    const totalMatch = data.text.match(/TOTAL A PAGAR\s*([\d,.]+)/i);
    const total = totalMatch ? parseFloat(totalMatch[1].replace(',', '.')) : 0;

    const artigos = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Caso 1: linha com nome + preço final ex: "(C)CALVE MAIONESE TD 240G 1,49"
      const singleLineMatch = line.match(/^(?:\([A-Z]\))?(.+?)\s+(\d+[.,]\d{2})$/);
      if (singleLineMatch) {
        artigos.push({
          nome: singleLineMatch[1].trim(),
          quantidade: 1,
          preco: parseFloat(singleLineMatch[2].replace(',', '.')),
        });
        continue;
      }

      // Caso 2: linha nome e próxima linha quantidade X preço unitário + total ex:
      // "(A)ATUM POSTA OLEO VEGETAL CNT 85G"
      // "8 X 0,93 7,44"
      if (i + 1 < lines.length) {
        const nextLine = lines[i + 1];
        const multiLineMatch = nextLine.match(/^([\d,.]+)\s*X\s*([\d,.]+)\s*([\d,.]+)$/);
        if (multiLineMatch) {
          const quantidade = parseFloat(multiLineMatch[1].replace(',', '.'));
          const precoUnitario = parseFloat(multiLineMatch[2].replace(',', '.'));
          artigos.push({
            nome: line.trim(),
            quantidade,
            preco: precoUnitario,
          });
          i++; // pula a próxima linha pois já foi processada
          continue;
        }
      }
    }

    return res.status(200).json({
      invoiceDate,
      total,
      artigos,
    });

  } catch (error) {
    console.error('Erro no parser PDF:', error);
    return res.status(500).json({ error: 'Failed to parse PDF', details: error.message });
  }
}
