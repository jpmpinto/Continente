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

    const dataBuffer = Buffer.from(pdfBase64, "base64");
    const data = await pdf(dataBuffer);
    const text = data.text;

    // Aqui poderás adicionar lógica para extrair artigos e preços do texto

    return res.status(200).json({ text });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
