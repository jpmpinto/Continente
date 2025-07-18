import pdf from 'pdf-parse';

export async function handler(event, context) {
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

    // Converter base64 para buffer
    const dataBuffer = Buffer.from(pdfBase64, 'base64');

    // Extrair texto do PDF
    const data = await pdf(dataBuffer);

    // Separar texto em linhas limpas
    const lines = data.text
      .split('\n')
      .map(l => l.trim())
      .filter(Boolean);

    // Array para guardar artigos extraídos
    const artigos = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Caso 1: linha com nome + preço, ex: "(C)CALVE MAIONESE TD 240G 1,49"
      const singleLineMatch = line.match(/^(?:\([A-Z]\))?(.+?)\s+(\d+[.,]\d{2})$/);
      if (singleLineMatch) {
        artigos.push({
          nome: singleLineMatch[1].trim(),
          quantidade: 1,
          preco: parseFloat(singleLineMatch[2].replace(',', '.')),
        });
        continue;
      }

      // Caso 2: linha nome e na próxima a quantidade x preço unitário + preço total
      if (i + 1 < lines.length) {
        const nextLine = lines[i + 1];

        // Exemplo: "8 X 0,93 7,44"
        const multiLineMatch = nextLine.match(/^(\d+(?:[.,]\d+)?)\s+X\s+(\d+[.,]\d{2})\s+(\d+[.,]\d{2})$/);
        if (multiLineMatch) {
          const quantidade = parseFloat(multiLineMatch[1].replace(',', '.'));
          const precoUnitario = parseFloat(multiLineMatch[2].replace(',', '.'));
          // Calcula o preço total (pode ser usado o terceiro grupo ou quantidade * precoUnitario)
          const precoTotal = quantidade * precoUnitario;

          artigos.push({
            nome: line.trim(),
            quantidade,
            preco: precoUnitario,
          });
          i++; // pula a próxima linha porque já foi processada
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
    console.error('Erro a processar PDF:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Failed to parse PDF', details: error.message }),
      headers: { 'Content-Type': 'application/json' },
    };
  }
}
