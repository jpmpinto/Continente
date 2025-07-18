import React, { useState, useEffect } from 'react';

function App() {
  const [artigos, setArtigos] = useState([]);
  const [quantidades, setQuantidades] = useState({});
  const [loading, setLoading] = useState(false);

  // Atualiza a quantidade de cada artigo
  const updateQuantidade = (idx, value) => {
    setQuantidades(prev => ({
      ...prev,
      [idx]: Number(value) > 0 ? Number(value) : 1,
    }));
  };

  // Carregar dados guardados do mês atual
  useEffect(() => {
    const monthKey = new Date().toISOString().slice(0,7); // "YYYY-MM"
    const saved = localStorage.getItem(monthKey);
    if (saved) {
      const savedArtigos = JSON.parse(saved);
      setArtigos(savedArtigos);
      const qts = {};
      savedArtigos.forEach((item, idx) => {
        qts[idx] = item.quantidade || 1;
      });
      setQuantidades(qts);
    }
  }, []);

  // Guardar artigos e quantidades no localStorage sempre que mudam
  useEffect(() => {
    if (artigos.length === 0) return;
    const monthKey = new Date().toISOString().slice(0,7);
    const toSave = artigos.map((item, idx) => ({
      ...item,
      quantidade: quantidades[idx] || 1,
    }));
    localStorage.setItem(monthKey, JSON.stringify(toSave));
  }, [artigos, quantidades]);

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = reader.result.split(',')[1];
      setLoading(true);
      try {
        const res = await fetch('/.netlify/functions/process-invoice', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pdfBase64: base64 }),
        });
        const data = await res.json();
        setArtigos(data.artigos || []);
        setQuantidades({}); // reset quantidades
      } catch (err) {
        console.error('Erro ao processar fatura:', err);
      } finally {
        setLoading(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const totalMes = artigos.reduce((acc, item, idx) => {
    const qtd = quantidades[idx] || 1;
    return acc + item.preco * qtd;
  }, 0);

  return (
    <div style={{ padding: 20 }}>
      <h1>Faturas Continente</h1>
      <input type="file" accept="application/pdf" onChange={handleFileUpload} />
      {loading && <p>A processar…</p>}
      {artigos.length > 0 && (
        <>
          <h2>Artigos extraídos</h2>
          <table border="1" cellPadding="8" style={{ borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th>Nome</th>
                <th>Preço (€)</th>
                <th>Quantidade</th>
                <th>Total (€)</th>
              </tr>
            </thead>
            <tbody>
              {artigos.map((item, idx) => (
                <tr key={idx}>
                  <td>{item.nome}</td>
                  <td>{item.preco.toFixed(2)}</td>
                  <td>
                    <input
                      type="number"
                      min="1"
                      value={quantidades[idx] || 1}
                      onChange={(e) => updateQuantidade(idx, e.target.value)}
                      style={{ width: 60 }}
                    />
                  </td>
                  <td>{((quantidades[idx] || 1) * item.preco).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <h3>Total gasto no mês: € {totalMes.toFixed(2)}</h3>
        </>
      )}
    </div>
  );
}

export default App;

