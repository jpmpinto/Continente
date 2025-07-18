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

      const singleLineMatch = line.match(/^(?:\([A-Z]\))?(.+?)\s+(\d+[.,]\d{2})$/);
      if (singleLineMatch) {
        artigos.push({
          nome: singleLineMatch[1].trim(),
          preco: parseFloat(singleLineMatch[2].replace(',', '.')),
        });
        continue;
      }

      if (i + 1 < lines.length) {
        const nextLine = lines[i + 1];
        const multiLineMatch = nextLine.match(/^(\d+)\s+X\s+(\d+[.,]\d{2})(\d+[.,]\d{2})$/);
        if (multiLineMatch) {
          const quantidade = parseInt(multiLineMatch[1], 10);
          const precoUnitario = parseFloat(multiLineMatch[2].replace(',', '.'));
          artigos.push({
            nome: line.trim(),
            preco: precoUnitario * quantidade,
          });
          i++;
          continue;
        }
      }
    }

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
