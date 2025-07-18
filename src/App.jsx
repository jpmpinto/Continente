import React, { useState } from 'react';

function App() {
  const [artigos, setArtigos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setError(null);
    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = reader.result.split(',')[1];
      setLoading(true);

      try {
        const response = await fetch('/process-invoice', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pdfBase64: base64 }),
        });

        console.log('Status da resposta:', response.status);
        if (!response.ok) {
          const text = await response.text();
          console.error('Resposta da API (não OK):', text);
          throw new Error(`Erro na API: ${response.status}`);
        }

        const data = await response.json();

        if (data.artigos && data.artigos.length > 0) {
          setArtigos(data.artigos);
        } else {
          setArtigos([]);
          setError('Nenhum artigo encontrado no PDF.');
        }
      } catch (err) {
        console.error('Erro ao processar fatura:', err);
        setError('Erro ao processar fatura. Verifica o console para mais detalhes.');
        setArtigos([]);
      } finally {
        setLoading(false);
      }
    };

    reader.readAsDataURL(file);
  };

  return (
    <div style={{ padding: 20 }}>
      <h1>Faturas Continente</h1>

      <input type="file" accept="application/pdf" onChange={handleFileUpload} />

      {loading && <p>A processar…</p>}

      {error && <p style={{ color: 'red' }}>{error}</p>}

      {artigos.length > 0 && (
        <div style={{ marginTop: 20 }}>
          <h2>Artigos extraídos:</h2>
          <table border="1" cellPadding="8" style={{ borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th>Nome</th>
                <th>Quantidade</th>
                <th>Preço Unitário (€)</th>
              </tr>
            </thead>
            <tbody>
              {artigos.map((item, idx) => (
                <tr key={idx}>
                  <td>{item.nome}</td>
                  <td>{item.quantidade !== undefined ? item.quantidade : '-'}</td>
                  <td>{item.preco ? item.preco.toFixed(2) : '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default App;
