import pdf from 'pdf-parse';

export const handler = async (event) => {
  // Log inicial para confirmar que a função foi chamada
  console.log('✅ process-invoice invoked');
  console.log('📌 HTTP Method:', event.httpMethod);

  if (event.httpMethod !== 'POST') {
    console.log('❌ Method not allowed');
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' }),
      headers: { 'Content-Type': 'application/json' },
    };
  }

  try {
    const bodyData = JSON.parse(event.body || '{}');
    const { pdfBase64 } = bodyData;
    if (!pdfBase64) {
      console.log('❌ Missing pdfBase64 in body');
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Missing pdfBase64 in body' }),
        headers: { 'Content-Type': 'application/json' },
      };
    }

    console.log('✅ PDF recebido com sucesso. Tamanho base64:', pdfBase64.length);

    const dataBuffer = Buffer.from(pdfBase64, 'base64');
    const data = await pdf(dataBuffer);

    console.log('✅ Texto extraído com sucesso. Primeiros 500 caracteres:');
    console.log(data.text.slice(0, 500)); // imprime só os primeiros caracteres

    const lines = data.text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);

    console.log(`✅ Total de linhas extraídas: ${lines.length}`);
    // opcional: logar algumas linhas para ver o formato
    lines.slice(0, 30).forEach((line, i) => console.log(`L${i}: ${line}`));

    const artigos = [];
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Caso 1: Nome e preço final na mesma linha
      const singleLineMatch = line.match(/^(?:\([A-Z]\))?(.+?)\s+(\d+[.,]\d{2})$/);
      if (singleLineMatch) {
        artigos.push({
          nome: singleLineMatch[1].trim(),
          preco: parseFloat(singleLineMatch[2].replace(',', '.')),
        });
        continue;
      }

      // Caso 2: Nome numa linha e logo a seguir quantidade e preços
      if (i + 1 < lines.length) {
        const nextLine = lines[i + 1];
        const multiLineMatch = nextLine.match(/^(\d+)\s+X\s+(\d+[.,]\d{2})\s+(\d+[.,]\d{2})$/);
        if (multiLineMatch) {
          const quantidade = parseInt(multiLineMatch[1], 10);
          const precoUnitario = parseFloat(multiLineMatch[2].replace(',', '.'));
          artigos.push({
            nome: line.trim(),
            preco: precoUnitario * quantidade,
          });
          i++; // salta a linha seguinte
          continue;
        }
      }
    }

    console.log(`✅ Total de artigos extraídos: ${artigos.length}`);
    artigos.forEach((a, idx) => console.log(`Artigo ${idx + 1}: ${a.nome} -> €${a.preco.toFixed(2)}`));

    return {
      statusCode: 200,
      body: JSON.stringify({ artigos }),
      headers: { 'Content-Type': 'application/json' },
    };

  } catch (error) {
    console.error('🔥 ERRO no processamento do PDF:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Failed to parse PDF', details: error.message }),
      headers: { 'Content-Type': 'application/json' },
    };
  }
};
