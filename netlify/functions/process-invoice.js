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
    let text = data.text;

    // --- Extrair data ---
    const dateMatch = text.match(/\d{2}\/\d{2}\/\d{4}/);
    const invoiceDate = dateMatch ? dateMatch[0] : '';

    // --- Extrair total a pagar ---
    const totalMatch = text.match(/TOTAL A PAGAR\s*([\d,.]+)/i);
    const total = totalMatch ? parseFloat(totalMatch[1].replace(',', '.')) : 0;

    // --- Pré-processar texto para juntar linhas quebradas ---
    const linhas = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    const linhasJuntas = [];
    for (let i = 0; i < linhas.length; i++) {
      const linha = linhas[i];
      const prox = linhas[i + 1] || '';

      // Se a linha atual parece um nome e a próxima começa com algo tipo "2,334 X 1,99"
      if (/^\(?[A-Z]/.test(linha) && /^[\d,.]+\s*X\s*[\d,.]+/.test(prox)) {
        linhasJuntas.push(linha + ' ' + prox);
        i++; // salta a próxima porque já juntámos
      } else {
        linhasJuntas.push(linha);
      }
    }

    // --- Extrair artigos ---
    const artigoRegex = /([A-Z0-9ÇÉÊÂÓÚÍÀÜºª\s\.\-\/]+?)\s+([\d,.]+)\s*X\s*([\d,.]+)\s+([\d,.]+)/g;
    const artigos = [];
    let match;

    for (const linha of linhasJuntas) {
      while ((match = artigoRegex.exec(linha)) !== null) {
        const nome = match[1].trim().replace(/\s+/g, ' ');
        const quantidade = parseFloat(match[2].replace(',', '.'));
        const precoUnit = parseFloat(match[3].replace(',', '.'));
        artigos.push({
          nome,
          quantidade,
          preco: precoUnit
        });
      }
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
