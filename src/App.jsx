import React, { useEffect, useState } from 'react';
import { supabase } from './supabaseClient';
import Papa from 'papaparse';

// 🔎 Função para normalizar nomes semelhantes
function normalizarNome(nomeOriginal) {
  const n = nomeOriginal.toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  if (n.includes('ATUM') && n.includes('OLEO') && n.includes('85')) {
    return 'ATUM OLEO 85G CONTINENTE';
  }
  return nomeOriginal;
}

/** =========================
 *  Importação por CSV
 *  Lê CSV no browser, agrupa por fatura, grava invoices + invoice_items no Supabase
 *  Colunas aceites:
 *   - fatura (opcional), data (YYYY-MM-DD), nome, quantidade, preco
 *   - aliases: invoice|invoice_id, date|invoiceDate, descricao|description, qty|qtd|quantidade_itens, preco_unitario|price|unit_price
 * ========================= */
function CSVImport({ user, onDone }) {
  const [rows, setRows] = useState([]);
  const [status, setStatus] = useState(null);

  // ✅ Correção: tratamento correto de vírgulas e pontos decimais
  const parseNumber = (v) => {
    if (v === null || v === undefined || v === '') return 0;
    let s = String(v).trim();

    // Normaliza formatos: "9,10" → "9.10", "9.1" → "9.10"
    if (s.includes(',')) s = s.replace(',', '.');

    // Remove tudo que não seja número ou ponto
    s = s.replace(/[^\d.]/g, '');

    // Evita erros tipo "9.10" → "910"
    const parts = s.split('.');
    if (parts.length > 2) s = parts[0] + '.' + parts.slice(1).join('');
    if (parts[1] && parts[1].length > 2) s = parts[0] + '.' + parts[1].slice(0, 2);

    const n = parseFloat(s);
    return Number.isFinite(n) ? n : 0;
  };

  const handleFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setStatus(null);
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (res) => {
        const data = res.data
          .map((r) => ({
            fatura: r.fatura || r.invoice || r.invoice_id || '',
            data: r.data || r.date || r.invoiceDate || '',
            nome: r.nome || r.descricao || r.description || '',
            quantidade: parseInt(r.quantidade ?? r.qty ?? r.qtd ?? r.quantidade_itens ?? 1, 10) || 1,
            preco: parseNumber(r.preco ?? r.preco_unitario ?? r.price ?? r.unit_price ?? 0),
          }))
          .filter((r) => r.nome);
        setRows(data);
      },
    });
  };

  const groupByInvoice = (arr) => {
    const m = new Map();
    for (const r of arr) {
      const key = r.fatura || r.data || 'UNICA';
      if (!m.has(key)) m.set(key, []);
      m.get(key).push(r);
    }
    return m;
  };

  const upload = async () => {
    if (!user) {
      setStatus({ ok: 0, fail: 1, errors: ['Sem utilizador autenticado'] });
      return;
    }
    if (!rows.length) return;

    setStatus('a_enviar');
    const groups = groupByInvoice(rows);
    let ok = 0,
      fail = 0;
    const errors = [];

    for (const [key, items] of groups.entries()) {
      const invoice_date = items[0].data || new Date().toISOString().slice(0, 10);
      const artigos = items.map((it) => ({
        nome: it.nome,
        quantidade: Number.isInteger(it.quantidade) ? it.quantidade : 1,
        preco: +it.preco || 0,
      }));
      const total = artigos.reduce((s, a) => s + a.quantidade * a.preco, 0);

      try {
        const { data: invoice, error: invErr } = await supabase
          .from('invoices')
          .insert([{ total, invoice_date, user_id: user.id }])
          .select()
          .single();
        if (invErr) throw invErr;

        const valid = artigos.filter((a) => Number.isInteger(a.quantidade));
        if (valid.length) {
          const toInsert = valid.map((a) => ({
            invoice_id: invoice.id,
            nome: a.nome,
            quantidade: a.quantidade,
            preco: a.preco,
          }));
          const { error: itemsErr } = await supabase.from('invoice_items').insert(toInsert);
          if (itemsErr) throw itemsErr;
        }
        ok++;
      } catch (e) {
        fail++;
        errors.push(`Fatura ${key}: ${e.message}`);
      }
    }

    setStatus({ ok, fail, errors });
    if (onDone) onDone();
  };

  return (
    <div style={{ border: '1px solid #ddd', padding: 16, borderRadius: 8 }}>
      <h3>Importação de Faturas por CSV</h3>
      <p>
        Formato: <code>fatura</code> (opcional), <code>data</code>, <code>nome</code>, <code>quantidade</code>,{' '}
        <code>preco</code>. Aceita cabeçalhos alternativos.
      </p>
      <input type="file" accept=".csv" onChange={handleFile} />
      {rows.length > 0 && (
        <div style={{ marginTop: 8 }}>
          <div>{rows.length} linhas lidas.</div>
          <button onClick={upload}>Enviar para Supabase</button>
        </div>
      )}
      {status === 'a_enviar' && <div style={{ marginTop: 8 }}>A enviar…</div>}
      {status && status.ok !== undefined && (
        <div style={{ marginTop: 8 }}>
          <div>
            Importadas: {status.ok}. Falhadas: {status.fail}.
          </div>
          {status.errors?.length ? (
            <details>
              <summary>Erros</summary>
              <ul>{status.errors.map((e, i) => <li key={i}>{e}</li>)}</ul>
            </details>
          ) : null}
        </div>
      )}
    </div>
  );
}

export default function App() {
  const [user, setUser] = useState(null);
  const [faturas, setFaturas] = useState([]);
  const [loadingFaturas, setLoadingFaturas] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [artigosAgregados, setArtigosAgregados] = useState([]);
  const [sortBy, setSortBy] = useState('quantidade');
  const [searchTerm, setSearchTerm] = useState('');
  const [uploadLoading, setUploadLoading] = useState(false);
  const [error, setError] = useState('');
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });
    return () => listener?.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (user) fetchFaturas();
    else {
      setFaturas([]);
      setSelectedInvoice(null);
      setArtigosAgregados([]);
    }
  }, [user]);

  useEffect(() => {
    if (faturas.length) fetchArtigosAgregados(faturas);
  }, [dataInicio, dataFim, faturas, sortBy]);

  async function fetchFaturas() {
    if (!user) return;
    setLoadingFaturas(true);
    try {
      const { data, error } = await supabase
        .from('invoices')
        .select('*')
        .eq('user_id', user.id)
        .order('invoice_date', { ascending: false });
      if (error) throw error;
      setFaturas(data);
      setSelectedInvoice(null);
    } catch (err) {
      setError('Erro ao carregar faturas: ' + err.message);
    } finally {
      setLoadingFaturas(false);
    }
  }

  async function fetchArtigosAgregados(faturasList) {
    if (!faturasList || !faturasList.length) return setArtigosAgregados([]);

    const filtradas = faturasList.filter((f) => {
      if (dataInicio && new Date(f.invoice_date) < new Date(dataInicio)) return false;
      if (dataFim && new Date(f.invoice_date) > new Date(dataFim)) return false;
      return true;
    });
    if (!filtradas.length) return setArtigosAgregados([]);

    const ids = filtradas.map((f) => f.id);
    const { data: itens, error } = await supabase
      .from('invoice_items')
      .select('id, nome, quantidade, preco')
      .in('invoice_id', ids);
    if (error) return console.error(error);

    const agrupados = {};
    itens.forEach(({ id, nome, quantidade, preco }) => {
      if (!Number.isInteger(quantidade)) return;
      const n = normalizarNome(nome);
      if (!agrupados[n]) agrupados[n] = { nome: n, quantidade: 0, valor: 0, ids: [] };
      agrupados[n].quantidade += quantidade;
      agrupados[n].valor += preco;
      agrupados[n].ids.push(id);
    });
    const result = Object.values(agrupados).sort((a, b) =>
      sortBy === 'quantidade' ? b.quantidade - a.quantidade : b.valor - a.valor
    );
    setArtigosAgregados(result);
  }

  async function openInvoice(id) {
    const { data: invoice } = await supabase.from('invoices').select('*').eq('id', id).single();
    const { data: items } = await supabase.from('invoice_items').select('*').eq('invoice_id', id);
    setSelectedInvoice({ ...invoice, items });
  }

  if (!user)
    return (
      <div style={{ padding: 20 }}>
        <h1>Login necessário</h1>
        <button
          onClick={async () => {
            const email = prompt('Indica o teu email:');
            if (!email) return;
            const { error } = await supabase.auth.signInWithOtp({
              email,
              options: { emailRedirectTo: window.location.origin },
            });
            if (error) alert('Erro no login: ' + error.message);
            else alert('Verifica o teu email para fazer login.');
          }}
        >
          Enviar email para login
        </button>
      </div>
    );

  return (
    <div style={{ padding: 20, maxWidth: 900, margin: 'auto', fontFamily: 'Arial, sans-serif' }}>
      <h1>Faturas do utilizador: {user.email}</h1>
      <button onClick={() => supabase.auth.signOut()}>Logout</button>

      <h2>Importar por CSV</h2>
      <CSVImport user={user} onDone={fetchFaturas} />

      <h2>Artigos agregados</h2>
      <input
        type="text"
        placeholder="Pesquisar artigo..."
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        style={{ marginBottom: 10, padding: 5, width: '100%' }}
      />
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ backgroundColor: '#eee' }}>
            <th style={{ border: '1px solid #ccc', padding: 8 }}>Artigo</th>
            <th style={{ border: '1px solid #ccc', padding: 8 }}>Qtd Total</th>
            <th style={{ border: '1px solid #ccc', padding: 8 }}>Valor Total (€)</th>
          </tr>
        </thead>
        <tbody>
          {artigosAgregados
            .filter((a) => a.nome.toLowerCase().includes(searchTerm.toLowerCase()))
            .map((a) => (
              <tr key={a.nome}>
                <td style={{ border: '1px solid #ccc', padding: 8 }}>{a.nome}</td>
                <td style={{ border: '1px solid #ccc', padding: 8 }}>{a.quantidade}</td>
                <td style={{ border: '1px solid #ccc', padding: 8 }}>{a.valor.toFixed(2)}</td>
              </tr>
            ))}
        </tbody>
      </table>

      <h2>Faturas Guardadas</h2>
      {loadingFaturas && <p>A carregar faturas...</p>}
      <ul style={{ listStyle: 'none', padding: 0 }}>
        {faturas.map((f) => (
          <li
            key={f.id}
            style={{
              border: '1px solid #ccc',
              marginBottom: 8,
              padding: 8,
              backgroundColor: selectedInvoice?.id === f.id ? '#def' : '#fff',
              cursor: 'pointer',
            }}
            onClick={() => openInvoice(f.id)}
          >
            <strong>{new Date(f.invoice_date).toLocaleDateString()}</strong> – Total:{' '}
            {f.total.toFixed(2)} €
          </li>
        ))}
      </ul>

      {selectedInvoice && (
        <div style={{ marginTop: 20, border: '1px solid #ccc', padding: 10 }}>
          <h3>Detalhes da Fatura</h3>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ backgroundColor: '#eee' }}>
                <th>Artigo</th>
                <th>Quantidade</th>
                <th>Preço (€)</th>
              </tr>
            </thead>
            <tbody>
              {selectedInvoice.items.map((i) => (
                <tr key={i.id}>
                  <td>{i.nome}</td>
                  <td>{i.quantidade}</td>
                  <td>{i.preco.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
