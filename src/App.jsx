import React, { useState, useEffect } from 'react';

// Função para listar chaves YYYY-MM no localStorage
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

  // Atualiza quantidade num mês selecionado
  const updateQuantidade = (idx, value) => {
    setQuantidades(prev => ({
      ...prev,
      [idx]: Number(value) > 0 ? Number(value) : 1,
    }));
  };

  // Carregar meses guardados e dados do mês atual ao montar
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

  // Guardar artigos e quantidades no localStorage sempre que mudam (apenas no mês atual)
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

  // Carregar dados do mês selecionado ao mudar de mês
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

  // Calcular total do mês selecionado
  const totalMes = artigos.reduce((acc, item, idx) => {
    const qtd = quantidades[idx] || 1;
    return acc + item.preco * qtd;
  }, 0);

  // Gerar estatísticas globais dos artigos mais comprados (de todos os meses)
  useEffect(() => {
    const keys = getMonthKeys();
    const artigoMap = {};

    keys.forEach(month => {
      const data = JSON.parse(localStorage.getItem(month));
      if (!data) return;
      data.forEach(item => {
        if (!item.nome) return;
        if (!artigoMap[item.nome]) {
          artigoMap[item.nome] = {
            nome: item.nome,
            quantidade: 0,
            gasto: 0,
          };
        }
        artigoMap[item.nome].quantidade += item.quantidade || 1;
        artigoMap[item.nome].gasto += (item.preco || 0) * (item.quantidade || 1);
      });
    });

    const artigosArr = Object.values(artigoMap);
    artigosArr.sort((a, b) => b.quantidade - a.quantidade);

    setStats(artigosArr);
  }, [monthKeys]);

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
        // Se estiveres a ver o mês atual, guarda os dados
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
    <div style={{ padding: 20, maxWidth: 900, margin: 'auto' }}>
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
        {stats.length === 0 ? (
          <p>Sem dados para mostrar.</p>
        ) : (
          <table border="1" cellPadding="8" style={{ borderCollapse: 'collapse', width: '100%' }}>
            <thead>
              <tr>
                <th>Nome</th>
                <th>Quantidade total</th>
                <th>Gasto total (€)</th>
              </tr>
            </thead>
            <tbody>
              {stats.map((item, idx) => (
                <tr key={idx}>
                  <td>{item.nome}</td>
                  <td>{item.quantidade.toFixed(2)}</td>
                  <td>{item.gasto.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}

export default App;
