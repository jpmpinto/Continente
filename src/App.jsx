import React, { useState } from 'react';

export default function App() {
  const [artigos, setArtigos] = useState([]);
  const [totalFatura, setTotalFatura] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    setLoading(true);
    setError('');
    setArtigos([]);
    setTotalFatura(0);

    try {
      const reader = new FileReader();
      reader.onload = async () => {
        const base64 = reader.result.split(',')[1];

        try {
          const response = await fetch('/.netlify/functions/process-invoice', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ pdfBase64: base64 }),
          });

          if (!response.ok) {
            throw new Error(`Erro na API: ${response.status}`);
          }

          const data = await response.json();
          console.log('Dados recebidos da API:', data);

          setArtigos(data.artigos || []);
          setTotalFatura(data.totalFatura || 0);
        } catch (err) {
          console.error('Erro ao processar fatura:', err);
          setError('Erro ao processar fatura. Ver consola para detalhes.');
        } finally {
          setLoading(false);
        }
      };
      reader.readAsDataURL(file);
    } catch (err) {
      console.error('Erro ao ler ficheiro:', err);
      setError('Erro ao ler ficheiro.');
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: 20, fontFamily: 'Arial, sans-serif' }}>
      <h1>📄 Carregar Fatura Continente</h1>
      <input type="file" accept="application/pdf" onChange={handleFileUpload} />
      {loading && <p>A processar fatura...</p>}
      {error && <p style={{ color: 'red' }}>{error}</p>}

      {artigos.length > 0 && (
        <div style={{ marginTop: 20 }}>
          <h2>🛒 Lista de Artigos</h2>
          <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 10 }}>
            <thead>
              <tr style={{ backgroundColor: '#f0f0f0' }}>
                <th style={{ border: '1px solid #ccc', padding: 8 }}>Artigo</th>
                <th style={{ border: '1px solid #ccc', padding: 8 }}>Quantidade</th>
                <th style={{ border: '1px solid #ccc', padding: 8 }}>Preço (€)</th>
              </tr>
            </thead>
            <tbody>
              {artigos.map((art, idx) => (
                <tr key={idx}>
                  <td style={{ border: '1px solid #ccc', padding: 8 }}>{art.nome}</td>
                  <td style={{ border: '1px solid #ccc', padding: 8, textAlign: 'center' }}>
                    {art.quantidade ?? 1}
                  </td>
                  <td style={{ border: '1px solid #ccc', padding: 8, textAlign: 'right' }}>
                    {art.preco.toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <h3 style={{ marginTop: 20 }}>
            💰 <strong>Total da Fatura: {(totalFatura || 0).toFixed(2)} €</strong>
          </h3>
        </div>
      )}
    </div>
  );
}
