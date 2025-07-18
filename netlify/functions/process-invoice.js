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
    const { pdfBase64 } = JSON.parse(event.body || '{}');
    if (!pdfBase64) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Missing pdfBase64 in body' }),
        headers: { 'Content-Type': 'application/json' },
      };
    }

    // Converter Base64 em buffer
    const dataBuffer = Buffer.from(pdfBase64, 'base64');

    // Ler o PDF com pdf-parse
    const data = await pdf(dataBuffer);

    // Separar texto em linhas
    const lines = data.text.split('\n').map((l) => l.trim()).filter(Boolean);
    console.info('🔎 Total de linhas extraídas:', lines.length);

    const artigos = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Caso simples: nome + preço na mesma linha
      const singleLineMatch = line.match(/^(?:\([A-Z]\))?(.+?)\s+(\d+[.,]\d{2})$/);
      if (singleLineMatch) {
        artigos.push({
          nome: singleLineMatch[1].trim(),
          quantidade: 1,
          preco: parseFloat(singleLineMatch[2].replace(',', '.')),
        });
        continue;
      }

      // Caso nome na linha e detalhe na seguinte
      if (i + 1 < lines.length) {
        const nextLineRaw = lines[i + 1];
        const nextLine = nextLineRaw.replace(/\s+/g, ''); // remover espaços

        const multiLineMatch = nextLine.match(/^(\d+(?:[.,]\d+)?)X(\d+[.,]\d+)(\d+[.,]\d+)$/);
        if (multiLineMatch) {
          const quantidade = parseFloat(multiLineMatch[1].replace(',', '.'));
          const precoUnitario = parseFloat(multiLineMatch[2].replace(',', '.'));
          artigos.push({
            nome: line.replace(/^\([A-Z]\)/, '').trim(),
            quantidade: quantidade,
            preco: parseFloat((quantidade * precoUnitario).toFixed(2)),
          });
          i++;
          continue;
        }
      }
    }

    console.info('✅ Total de artigos extraídos:', artigos.length);
    artigos.forEach((a, idx) =>
      console.info(`Artigo ${idx + 1}: ${a.nome} (qtd ${a.quantidade}) -> €${a.preco}`)
    );

    const totalFatura = artigos.reduce((acc, art) => acc + art.preco, 0);

    return {
      statusCode: 200,
      body: JSON.stringify({ artigos, totalFatura }),
      headers: { 'Content-Type': 'application/json' },
    };
  } catch (error) {
    console.error('❌ Erro ao processar PDF:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Failed to parse PDF', details: error.message }),
      headers: { 'Content-Type': 'application/json' },
    };
  }
};
