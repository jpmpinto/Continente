import pdf from "pdf-parse";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { pdfBase64 } = req.body;
    if (!pdfBase64) {
      return res.status(400).json({ error: "Missing pdfBase64 in body" });
    }

    // Decodifica base64 para buffer
    const dataBuffer = Buffer.from(pdfBase64, "base64");

    // Extrai texto do PDF
    const data = await pdf(dataBuffer);

    // Aqui precisas de parsear data.text para extrair os artigos e preços
    const text = data.text;

    // Para já, só vamos devolver o texto todo
    return res.status(200).json({ text });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
