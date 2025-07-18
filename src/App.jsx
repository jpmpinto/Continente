import React, { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

function downloadCSV(data, filename) {
  if (!data.length) return;

  const headers = Object.keys(data[0]);
  const csvRows = [
    headers.join(','),
    ...data.map(row => headers.map(field => {
      const escaped = ('' + row[field]).replace(/"/g, '""');
      return `"${escaped}"`;
    }).join(','))
  ];

  const csvString = csvRows.join('\n');
  const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

function getMonthKeys() {
  return Object.keys(localStorage).filter(key => /^\d{4}-\d{2}$/.test(key));
}

function App() {
  const [artigos, setArtigos] = useState([]);
  const [quantidades, setQuantidades] = useState({});
  const [loading, setLoading] = useState(false);
  const [monthKeys, setMonthKeys] = useState([]);
  const [selectedMonth, setSelectedMonth] = useState('');
  const [stats, setStats] = useState([]);
  const [monthlyTotals, setMonthlyTotals] = useState([]);

  const updateQuantidade = (idx, value) => {
    setQuantidades(prev => ({
      ...prev,
      [idx]: Number(value) > 0 ? Number(value) : 1,
    }));
  };

  useEffect(() => {
    const keys = getMonthKeys();
    setMonthKeys(keys);

    const currentMonth = new Date().toISOString().slice(0, 7);
    setSelectedMonth(currentMonth);

    const saved = localStorage.getItem(currentMonth);
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

  useEffect(() => {
    if (artigos.length === 0) return;
    const currentMonth = new Date().toISOString().slice(0, 7);
    if (selectedMonth === currentMonth) {
      const toSave = artigos.map((item, idx) => ({
        ...item,
        quantidade: quantidades[idx] || 1,
      }));
      localStorage.setItem(currentMonth, JSON.stringify(toSave));
    }
  }, [artigos, quantidades, selectedMonth]);

  useEffect(() => {
    if (!selectedMonth) return;
    const saved = localStorage.getItem(selectedMonth);
    if (saved) {
      const savedArtigos = JSON.parse(saved);
      setArtigos(savedArtigos);
      const qts = {};
      savedArtigos.forEach((item, idx) => {
        qts[idx] = item.quantidade || 1;
      });
      setQuantidades(qts);
    } else {
      setArtigos([]);
      setQuantidades({});
    }
  }, [selectedMonth]);

  // Estatísticas globais
  useEffect(() => {
    const keys = getMonthKeys();
    const artigoMap = {};
    const totals = [];

    keys.forEach(month => {
      const data = JSON.parse(localStorage.getItem(month));
      if (!data) return;

      // Total gasto no mês
      let totalMes = 0;

      data.forEach(item => {
        if (!item.nome) return;
        if (!artigoMap[item.nome]) {
          artigoMap[item.nome] = {
            nome: item.nome,
            quantidade: 0,
            gasto: 0,
          };
        }
        const qtd = item.quantidade || 1;
        artigoMap[item.nome].quantidade += qtd;
        artigoMap[item.nome].gasto += (item.preco || 0) * qtd;

        totalMes += (item.preco || 0) * qtd;
      });

      totals.push({ month, total: parseFloat(totalMes.toFixed(2)) });
    });

    const artigosArr = Object.values(artigoMap);
    artigosArr.sort((a, b) => b.quantidade - a.quantidade);

    setStats(artigosArr);
    setMonthlyTotals(totals.sort((a,b) => a.month.localeCompare(b.month)));
  }, [monthKeys]);

  const totalMes = artigos.reduce((acc, item, idx) => {
    const qtd = quantidades[idx] || 1;
    return acc + item.preco * qtd;
  }, 0);

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
        setQuantidades({});
        if (selectedMonth === new Date().toISOString().slice(0,7)) {
          const toSave = (data.artigos || []).map(item => ({ ...item, quantidade: 1 }));
          localStorage.setItem(selectedMonth, JSON.stringify(toSave));
          setQuantidades({});
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
    <div style={{ padding: 20, maxWidth: 1000, margin: 'auto' }}>
      <h1>Faturas Continente</h1>
      <input type="file" accept="application/pdf" onChange={handleFileUpload} />
      {loading && <p>A processar…</p>}

      <section style={{ marginTop: 20 }}>
        <label>
          <strong>Selecionar mês: </strong>
          <select value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)}>
            {monthKeys.map(month => (
              <option key={month} value={month}>{month}</option>
            ))}
          </select>
        </label>
        <button
          style={{ marginLeft: 10 }}
          onClick={() => downloadCSV(artigos.map((item, idx) => ({
            Nome: item.nome,
            Preco: item.preco.toFixed(2),
            Quantidade: quantidades[idx] || 1,
            Total: ((quantidades[idx] || 1) * item.preco).toFixed(2),
          })), `faturas_${selectedMonth}.csv`)}
        >
          Exportar CSV do mês
        </button>
      </section>

      {artigos.length > 0 ? (
        <>
          <h2>Artigos extraídos - {selectedMonth}</h2>
          <table border="1" cellPadding="8" style={{ borderCollapse: 'collapse', width: '100%' }}>
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
                    {selectedMonth === new Date().toISOString().slice(0,7) ? (
                      <input
                        type="number"
                        min="1"
                        value={quantidades[idx] || 1}
                        onChange={(e) => updateQuantidade(idx, e.target.value)}
                        style={{ width: 60 }}
                      />
                    ) : (
                      quantidades[idx] || 1
                    )}
                  </td>
                  <td>{((quantidades[idx] || 1) * item.preco).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <h3>Total gasto no mês: € {totalMes.toFixed(2)}</h3>
        </>
      ) : (
        <p>Nenhum artigo para este mês.</p>
      )}

      <section style={{ marginTop: 40 }}>
        <h2>Estatísticas dos artigos mais comprados (todos os meses)</h2>
        <button onClick={() => downloadCSV(stats.map(s => ({
          Nome: s.nome,
          Quantidade: s.quantidade.toFixed(2),
          Gasto: s.gasto.toFixed(2),
        })), 'estatisticas_artigos.csv')}>
          Exportar CSV Estatísticas
        </button>

        {stats.length === 0 ? (
          <p>Sem dados para mostrar.</p>
        ) : (
          <>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={stats.slice(0, 10)} margin={{ top: 5, right: 30, left: 20, bottom: 40 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="nome" angle={-45} textAnchor="end" interval={0} height={80} />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="quantidade" fill="#8884d8" name="Quantidade" />
              </BarChart>
            </ResponsiveContainer>
          </>
        )}
      </section>

      <section style={{ marginTop: 40 }}>
        <h2>Total gasto por mês</h2>
        {monthlyTotals.length === 0 ? (
          <p>Sem dados para mostrar.</p>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={monthlyTotals} margin={{ top: 5, right: 30, left: 20, bottom: 40 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="total" fill="#82ca9d" name="Total (€)" />
            </BarChart>
          </ResponsiveContainer>
        )}
      </section>
    </div>
  );
}

export default App;
