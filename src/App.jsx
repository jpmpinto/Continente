import React, { useState, useEffect } from 'react';

function App() {
  const [artigos, setArtigos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [invoiceDate, setInvoiceDate] = useState('');
  const [total, setTotal] = useState(0);

  const [monthlyTotals, setMonthlyTotals] = useState({});
  const [artigosStats, setArtigosStats] = useState({});

  // Carregar estatísticas ao iniciar
  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const res = await fetch('/.netlify/functions/get-stats');
      const data = await res.json();
      setMonthlyTotals(data.monthlyTotals || {});
      setArtigosStats(data.artigos || {});
    } catch (err) {
      console.error('Erro ao buscar stats:', err);
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = reader.result.split(',')[1];
      setLoading(true);
      try {
        // Processar PDF no backend existente
        const response = await fetch('/api/process-invoice', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pdfBase64: base64 })
        });
        const data = await response.json();

        const artigosExtraidos = data.artigos || [];
        setArtigos(artigosExtraidos);
        setInvoiceDate(data.invoiceDate || '');
        setTotal(data.total || 0);

        // Guardar na base de dados Supabase
        if (artigosExtraidos.length > 0 && data.invoiceDate && data.total) {
          await fetch('/.netlify/functions/add-invoice', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              invoiceDate: data.invoiceDate,
              total: data.total,
              artigos: artigosExtraidos
            })
          });

          // Atualizar estatísticas depois de guardar
          fetchStats();
        }
      } catch (err) {
        console.error('Erro ao processar fatura:', err);
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

      {/* Fatura atual */}
      {artigos.length > 0 && (
        <div style={{ marginTop: 20 }}>
          <h2>Fatura processada</h2>
          {invoiceDate && <p><strong>Data:</strong> {invoiceDate}</p>}
          <p><strong>Total:</strong> €{total.toFixed(2)}</p>
          <table border="1" cellPadding="8" style={{ borderCollapse: 'collapse', marginTop: 10 }}>
            <thead>
              <tr>
                <th>Nome</th>
                <th>Preço (€)</th>
                <th>Quantidade</th>
              </tr>
            </thead>
            <tbody>
              {artigos.map((item, idx) => (
                <tr key={idx}>
                  <td>{item.nome}</td>
                  <td>{item.preco.toFixed(2)}</td>
                  <td>{item.quantidade}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Estatísticas */}
      <div style={{ marginTop: 40 }}>
        <h2>Estatísticas acumuladas</h2>
        <h3>Totais por mês</h3>
        <ul>
          {Object.entries(monthlyTotals).map(([month, total]) => (
            <li key={month}>
              {month}: €{total.toFixed(2)}
            </li>
          ))}
        </ul>

        <h3>Artigos mais comprados</h3>
        <table border="1" cellPadding="8" style={{ borderCollapse: 'collapse', marginTop: 10 }}>
          <thead>
            <tr>
              <th>Artigo</th>
              <th>Quantidade</th>
              <th>Total (€)</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(artigosStats).map(([nome, stats]) => (
              <tr key={nome}>
                <td>{nome}</td>
                <td>{stats.quantidade}</td>
                <td>{stats.total.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default App;
