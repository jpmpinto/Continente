import pdf from 'pdf-parse';

export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    console.log('📥 Body recebido:', req.body?.pdfBase64 ? 'PDF recebido' : 'Nada recebido');

    const { pdfBase64 } = req.body;
    if (!pdfBase64) {
      console.log('❌ Falta pdfBase64');
      return res.status(400).json({ error: 'Missing pdfBase64 in body' });
    }

    const dataBuffer = Buffer.from(pdfBase64, 'base64');
    const data = await pdf(dataBuffer);
    let text = data.text;

    // limpeza
    text = text.replace(/\r/g, ' ').replace(/\u2028/g, ' ').replace(/\u00A0/g, ' ');

    console.log('📝 Texto extraído (primeiros 500 chars):', text.slice(0, 500));

    const dateMatch = text.match(/\d{2}\/\d{2}\/\d{4}/);
    const invoiceDate = dateMatch ? dateMatch[0] : '';

    const totalMatch = text.match(/TOTAL A PAGAR\s*([\d,.]+)/i);
    const total = totalMatch ? parseFloat(totalMatch[1].replace(',', '.')) : 0;

    // juntar linhas
    const linhas = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    const linhasJuntas = [];
    for (let i = 0; i < linhas.length; i++) {
      const linha = linhas[i];
      const prox = linhas[i + 1] || '';
      if (/^\(?[A-Z]/.test(linha) && /^[\d,.]+\s*X\s*[\d,.]+/.test(prox)) {
        linhasJuntas.push(linha + ' ' + prox);
        i++;
      } else {
        linhasJuntas.push(linha);
      }
    }

    const artigoRegex = /([A-Z0-9ÇÉÊÂÓÚÍÀÜºª\s\.\-\/]+?)\s+([\d,.]+)\s*X\s*([\d,.]+)\s+([\d,.]+)/g;
    const artigos = [];
    let match;
    for (const linha of linhasJuntas) {
      while ((match = artigoRegex.exec(linha)) !== null) {
        artigos.push({
          nome: match[1].trim().replace(/\s+/g, ' '),
          quantidade: parseFloat(match[2].replace(',', '.')),
          preco: parseFloat(match[3].replace(',', '.'))
        });
      }
    }

    console.log('✅ Artigos encontrados:', artigos);

    return res.status(200).json({ invoiceDate, total, artigos });
  } catch (error) {
    console.error('🔥 Erro no process-invoice:', error);
    return res.status(500).json({ error: 'Failed to process PDF', details: error.message });
  }
}
