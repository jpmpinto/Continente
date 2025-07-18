import pdf from 'pdf-parse';

export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    const { pdfBase64 } = req.body;
    if (!pdfBase64) {
      return res.status(400).json({ error: 'Missing pdfBase64 in body' });
    }

    const dataBuffer = Buffer.from(pdfBase64, 'base64');
    const data = await pdf(dataBuffer);
    const text = data.text;

    // --- Extrair data ---
    const dateMatch = text.match(/\d{2}\/\d{2}\/\d{4}/);
    const invoiceDate = dateMatch ? dateMatch[0] : '';

    // --- Extrair total a pagar ---
    const totalMatch = text.match(/TOTAL A PAGAR\s*([\d,.]+)/i);
    const total = totalMatch ? parseFloat(totalMatch[1].replace(',', '.')) : 0;

    // --- Extrair artigos ---
    // Padrão para capturar linhas como:
    // (A)ATUM POSTA OLEO VEGETAL CNT 85G 8 X 0,93 7,44
    const artigoRegex = /([A-ZÇ0-9\s\.\-\/]+?)\s+([\d,.]+)\s*X\s*([\d,.]+)\s+([\d,.]+)/g;
    const artigos = [];
    let match;

    while ((match = artigoRegex.exec(text)) !== null) {
      const nome = match[1].trim().replace(/\s+/g, ' ');
      const quantidade = parseFloat(match[2].replace(',', '.'));
      const precoUnit = parseFloat(match[3].replace(',', '.'));
      // const totalLinha = parseFloat(match[4].replace(',', '.')); // se precisares do total por linha

      artigos.push({
        nome,
        quantidade,
        preco: precoUnit
      });
    }

    return res.status(200).json({
      invoiceDate,
      total,
      artigos
    });

  } catch (error) {
    console.error('Erro no process-invoice:', error);
    return res.status(500).json({ error: 'Failed to process PDF', details: error.message });
  }
}
