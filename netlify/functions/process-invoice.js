import pdf from 'pdf-parse';

export const handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' }),
      headers: { 'Content-Type': 'application/json' },
    };
  }

  try {
    const { pdfBase64 } = JSON.parse(event.body);
    if (!pdfBase64) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Missing pdfBase64 in body' }),
        headers: { 'Content-Type': 'application/json' },
      };
    }

    const dataBuffer = Buffer.from(pdfBase64, 'base64');
    const data = await pdf(dataBuffer);

    const lines = data.text.split('\n').map(l => l.trim()).filter(Boolean);

    const artigos = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Caso 1: nome + preço final na mesma linha
      const singleLineMatch = line.match(/^(?:\([A-Z]\))?(.+?)\s+(\d+[.,]\d{2})$/);
      if (singleLineMatch) {
        artigos.push({
          nome: singleLineMatch[1].trim(),
          preco: parseFloat(singleLineMatch[2].replace(',', '.')),
        });
        continue;
      }

      // Caso 2: nome numa linha e na seguinte quantidade X preço unitário preço total
      if (i + 1 < lines.length) {
        const nextLine = lines[i + 1];

        // Aceita espaços flexíveis e vírgulas ou pontos
        const multiLineMatch = nextLine.match(
          /^(\d+(?:[.,]\d{1,3})?)\s*X\s*(\d+[.,]\d{2})\s+(\d+[.,]\d{2})$/
        );

        if (multiLineMatch) {
          const quantidade = parseFloat(multiLineMatch[1].replace(',', '.'));
          const precoUnit = parseFloat(multiLineMatch[2].replace(',', '.'));
          const precoTotal = parseFloat(multiLineMatch[3].replace(',', '.'));

          // Preferir o preço total do PDF
          artigos.push({
            nome: line.replace(/^\([A-Z]\)/, '').trim(),
            preco: precoTotal || (precoUnit * quantidade),
          });

          i++; // saltar a linha seguinte porque já foi processada
          continue;
        }
      }
    }

    console.info(`✅ Total de artigos extraídos: ${artigos.length}`);
    artigos.forEach((a, idx) => {
      console.info(`Artigo ${idx + 1}: ${a.nome} -> €${a.preco}`);
    });

    return {
      statusCode: 200,
      body: JSON.stringify({ artigos }),
      headers: { 'Content-Type': 'application/json' },
    };

  } catch (error) {
    console.error('Error parsing PDF:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Failed to parse PDF', details: error.message }),
      headers: { 'Content-Type': 'application/json' },
    };
  }
};
