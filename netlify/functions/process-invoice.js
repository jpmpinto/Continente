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

    // Exemplo simples de parser:
    const artigos = [];
    const lines = data.text.split('\n');

    lines.forEach(line => {
      // Ajusta o regex ao teu formato real
      const match = line.match(/^(.+?)\s+(\d+,\d{2})$/);
      if (match) {
        artigos.push({
          nome: match[1].trim(),
          preco: parseFloat(match[2].replace(',', '.'))
        });
      }
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
