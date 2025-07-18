import React, { useState, useEffect } from 'react';
import {
  LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer,
  BarChart, Bar, Legend
} from 'recharts';

function App() {
  const [artigos, setArtigos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [invoiceDate, setInvoiceDate] = useState('');
  const [total, setTotal] = useState(0);

  const [monthlyTotals, setMonthlyTotals] = useState({});
  const [artigosStats, setArtigosStats] = useState({});

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

  // Transformar dados para gráficos
  const monthlyChartData = Object.entries(monthlyTotals).map(([month, value]) => ({
    month,
    total: Number(value.toFixed(2))
  }));

  const artigosChartData = Object.entries(artigosStats).map(([nome, stats]) => ({
    nome,
    quantidade: stats.quantidade,
    total: Number(stats.total.toFixed(2))
  }));

  return (
    <div style={{ padding: 20, fontFamily: 'Arial, sans-serif' }}>
      <h1 style={{ marginBottom: 20 }}>📊 Faturas Continente</h1>
      <input type="file" accept="application/pdf" onChange={handleFileUpload} />
      {loading && <p>A processar…</p>}

      {/* Fatura atual */}
      {artigos.length > 0 && (
        <div style={{ marginTop: 40 }}>
          <h2>🧾 Fatura processada</h2>
          {invoiceDate && <p><strong>Data:</strong> {invoiceDate}</p>}
          <p><strong>Total:</strong> €{total.toFixed(2)}</p>
          <table border="1" cellPadding="8" style={{ borderCollapse: 'collapse', marginTop: 10 }}>
            <thead>
              <tr style={{ background: '#f0f0f0' }}>
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
      <div style={{ marginTop: 60 }}>
        <h2>📈 Estatísticas acumuladas</h2>

        {/* Totais por mês */}
        <h3 style={{ marginTop: 30 }}>Totais por mês (€)</h3>
        <div style={{ width: '100%', height: 300 }}>
          <ResponsiveContainer>
            <LineChart data={monthlyChartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="total" stroke="#8884d8" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Artigos mais comprados */}
        <h3 style={{ marginTop: 30 }}>Artigos mais comprados</h3>
        <div style={{ width: '100%', height: 400 }}>
          <ResponsiveContainer>
            <BarChart data={artigosChartData} layout="vertical" margin={{ left: 100 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" />
              <YAxis dataKey="nome" type="category" width={150} />
              <Tooltip />
              <Legend />
              <Bar dataKey="quantidade" fill="#82ca9d" name="Qtd" />
              <Bar dataKey="total" fill="#8884d8" name="Total €" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Tabela acumulada */}
        <h3 style={{ marginTop: 30 }}>Tabela acumulada</h3>
        <table border="1" cellPadding="8" style={{ borderCollapse: 'collapse', marginTop: 10 }}>
          <thead>
            <tr style={{ background: '#f0f0f0' }}>
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
