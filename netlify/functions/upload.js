exports.handler = async (event, context) => {
  // event.body tem o conteúdo enviado
  // aqui fazes o mesmo processamento que tinhas no /api/upload
  const responseJson = { message: "Upload processado com sucesso!" };

  return {
    statusCode: 200,
    body: JSON.stringify(responseJson),
  };
};
