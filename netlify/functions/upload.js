// netlify/functions/upload.js
exports.handler = async (event, context) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  // Se precisares de processar FormData, usa um parser apropriado aqui.
  // Por agora, vou devolver apenas uma mensagem de teste:
  const responseData = {
    status: 'success',
    message: 'Ficheiro recebido e processado com sucesso!',
    // podes adicionar mais dados aqui conforme o teu processamento
  };

  return {
    statusCode: 200,
    body: JSON.stringify(responseData),
    headers: { 'Content-Type': 'application/json' }
  };
};
