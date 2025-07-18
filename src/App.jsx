import React, { useState } from "react";

export default function App() {
  const [artigos, setArtigos] = useState([]);
  const [totalFatura, setTotalFatura] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async () => {
      const base64String = reader.result.split(",")[1];
      setLoading(true);
      setError("");

      try {
        const response = await fetch("/.netlify/functions/process-invoice", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ pdfBase64: base64String }),
        });

        if (!response.ok) {
          console.error("Status da resposta:", response.status);
          throw new Error(`Erro na API: ${response.status}`);
        }

        const data = await response.json();
        setArtigos(data.artigos || []);
        setTotalFatura(data.totalFatura || 0);
      } catch (err) {
        console.error("Erro ao processar fatura:", err);
        setError("Não foi possível processar a fatura.");
      } finally {
        setLoading(false);
      }
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Leitor de Faturas</h1>
      <input type="file" accept="application/pdf" onChange={handleFileUpload} className="mb-4" />

      {loading && <p className="text-blue-500">A processar fatura...</p>}
      {error && <p className="text-red-500">{error}</p>}

      {artigos.length > 0 && (
        <div className="mt-4">
          <h2 className="text-xl font-semibold mb-2">Artigos extraídos:</h2>
          <table className="w-full border">
            <thead>
              <tr className="bg-gray-100">
                <th className="border px-2 py-1 text-left">Nome</th>
                <th className="border px-2 py-1 text-right">Quantidade</th>
                <th className="border px-2 py-1 text-right">Preço (€)</th>
              </tr>
            </thead>
            <tbody>
              {artigos.map((art, idx) => (
                <tr key={idx}>
                  <td className="border px-2 py-1">{art.nome}</td>
                  <td className="border px-2 py-1 text-right">{art.quantidade}</td>
                  <td className="border px-2 py-1 text-right">{art.preco.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <h2 className="text-lg font-bold mt-4">
            Total gasto nesta fatura: €{totalFatura.toFixed(2)}
          </h2>
        </div>
      )}
    </div>
  );
}
