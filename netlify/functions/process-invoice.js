// netlify/functions/process-invoice.js
exports.handler = async (event, context) => {
  // Apenas aceita POST
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Method Not Allowed' })
    };
  }

  try {
    // O body vem como string JSON
    const body = JSON.parse(event.body);

    // Aqui terias a lógica de processar o PDF.
    // Para já vamos devolver um mock para confirmar que funciona:
    const artigos = [
      { nome: 'Produto Teste A', preco: 1.99 },
      { nome: 'Produto Teste B', preco: 3.50 },
      { nome: 'Produto Teste C', preco: 0.99 }
    ];

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ artigos })
    };
  } catch (err) {
    console.error('Erro ao processar fatura:', err);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Erro interno ao processar fatura' })
    };
  }
};
