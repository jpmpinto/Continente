import React, { useEffect, useState } from 'react';
import { supabase } from './supabaseClient';

export default function App() {
  const [user, setUser] = useState(null);
  const [faturas, setFaturas] = useState([]);
  const [loadingFaturas, setLoadingFaturas] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [artigosAgregados, setArtigosAgregados] = useState([]);
  const [sortBy, setSortBy] = useState('quantidade');
  const [uploadLoading, setUploadLoading] = useState(false);
  const [error, setError] = useState('');

  // Observar user logado
  useEffect(() => {
    // Primeiro obter sessão atual
    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null);
    });

    // Listener de alterações de auth
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => {
      listener?.subscription.unsubscribe();
    };
  }, []);

  // Carregar faturas quando user está definido
  useEffect(() => {
    if (user) {
      fetchFaturas();
    } else {
      setFaturas([]);
      setSelectedInvoice(null);
      setArtigosAgregados([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]); // só reage a mudanças no user

  async function fetchFaturas() {
    if (!user) return; // segurança extra
    setLoadingFaturas(true);
    setError('');
    try {
      const { data, error } = await supabase
        .from('invoices')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setFaturas(data);
      setSelectedInvoice(null);
      await fetchArtigosAgregados(data);
    } catch (err) {
      console.error('❌ Erro ao carregar faturas:', err);
      setError('Erro ao carregar faturas: ' + err.message);
    } finally {
      setLoadingFaturas(false);
    }
  }

  async function fetchArtigosAgregados(faturasList) {
    if (!faturasList || faturasList.length === 0) {
      setArtigosAgregados([]);
      return;
    }
    try {
      const invoiceIds = faturasList.map((f) => f.id);
      const { data: itens, error } = await supabase
        .from('invoice_items')
        .select('nome, quantidade, preco')
        .in('invoice_id', invoiceIds);
      if (error) throw error;

      const agrupados = {};
      itens.forEach(({ nome, quantidade, preco }) => {
        if (!agrupados[nome]) {
          agrupados[nome] = { nome, quantidade: 0, valor: 0 };
        }
        agrupados[nome].quantidade += quantidade;
        agrupados[nome].valor += preco;
      });

      let result = Object.values(agrupados);
      if (sortBy === 'quantidade') {
        result.sort((a, b) => b.quantidade - a.quantidade);
      } else {
        result.sort((a, b) => b.valor - a.valor);
      }
      setArtigosAgregados(result);
    } catch (err) {
      console.error('❌ Erro a carregar artigos agregados:', err);
      setError('Erro a carregar artigos agregados: ' + err.message);
    }
  }

  async function openInvoice(id) {
    try {
      const { data: invoice, error } = await supabase
        .from('invoices')
        .select('*')
        .eq('id', id)
        .single();
      if (error) throw error;

      const { data: items, error: itemsError } = await supabase
        .from('invoice_items')
        .select('*')
        .eq('invoice_id', id);
      if (itemsError) throw itemsError;

      setSelectedInvoice({ ...invoice, items });
    } catch (err) {
      console.error('❌ Erro ao abrir fatura:', err);
      setError('Erro ao abrir fatura: ' + err.message);
    }
  }

  async function deleteInvoice(id) {
    if (!window.confirm('Tem a certeza que quer apagar esta fatura?')) return;
    try {
      const { error } = await supabase.from('invoices').delete().eq('id', id);
      if (error) throw error;
      fetchFaturas();
    } catch (err) {
      console.error('❌ Erro ao apagar fatura:', err);
      setError('Erro ao apagar fatura: ' + err.message);
    }
  }

  async function saveItemChanges(itemId, quantidade, preco) {
    try {
      const { error } = await supabase
        .from('invoice_items')
        .update({ quantidade, preco })
        .eq('id', itemId);
      if (error) throw error;
      openInvoice(selectedInvoice.id);
      fetchFaturas();
    } catch (err) {
      console.error('❌ Erro ao guardar artigo:', err);
      setError('Erro ao guardar artigo: ' + err.message);
    }
  }

  async function handleFileUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    setUploadLoading(true);
    try {
      const reader = new FileReader();
      reader.onload = async () => {
        const base64 = reader.result.split(',')[1];
        const response = await fetch('/.netlify/functions/process-invoice', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pdfBase64: base64 }),
        });
        if (!response.ok) throw new Error(`Erro na API: ${response.status}`);
        const data = await response.json();
        const { totalFatura, artigos } = data;

        const { data: invoice, error: invoiceError } = await supabase
          .from('invoices')
          .insert([{ total: totalFatura, invoice_date: new Date(), user_id: user.id }])
          .select()
          .single();
        if (invoiceError) throw invoiceError;

        const artigosValidos = artigos.filter((a) => Number.isInteger(a.quantidade));
        const itemsToInsert = artigosValidos.map((art) => ({
          invoice_id: invoice.id,
          nome: art.nome,
          quantidade: art.quantidade,
          preco: art.preco,
        }));
        const { error: itemsError } = await supabase.from('invoice_items').insert(itemsToInsert);
        if (itemsError) throw itemsError;

        fetchFaturas();
        alert('Fatura guardada com sucesso!');
      };
      reader.readAsDataURL(file);
    } catch (err) {
      console.error('❌ Erro ao processar fatura:', err);
      setError('Erro ao processar fatura: ' + err.message);
    } finally {
      setUploadLoading(false);
    }
  }

  function changeSort(by) {
    setSortBy(by);
    fetchArtigosAgregados(faturas);
  }

  if (!user) {
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
  }

  return (
    <div style={{ padding: 20, maxWidth: 900, margin: 'auto', fontFamily: 'Arial, sans-serif' }}>
      <h1>Faturas do utilizador: {user.email}</h1>
      <button onClick={() => supabase.auth.signOut()}>Logout</button>

      <h2>Carregar nova fatura</h2>
      <input type="file" accept="application/pdf" onChange={handleFileUpload} disabled={uploadLoading} />
      {uploadLoading && <p>A carregar fatura...</p>}
      {error && <p style={{ color: 'red' }}>{error}</p>}

      <h2>Artigos agregados</h2>
      <button onClick={() => changeSort('quantidade')} disabled={sortBy === 'quantidade'}>
        Ordenar por Quantidade
      </button>
      <button onClick={() => changeSort('valor')} disabled={sortBy === 'valor'}>
        Ordenar por Valor
      </button>

      <table style={{ width: '100%', marginTop: 10, marginBottom: 30, borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ backgroundColor: '#eee' }}>
            <th style={{ border: '1px solid #ccc', padding: 8 }}>Artigo</th>
            <th style={{ border: '1px solid #ccc', padding: 8, textAlign: 'right' }}>Qtd Total</th>
            <th style={{ border: '1px solid #ccc', padding: 8, textAlign: 'right' }}>Valor Total (€)</th>
          </tr>
        </thead>
        <tbody>
          {artigosAgregados.map((a) => (
            <tr key={a.nome}>
              <td style={{ border: '1px solid #ccc', padding: 8 }}>{a.nome}</td>
              <td style={{ border: '1px solid #ccc', padding: 8, textAlign: 'right' }}>{a.quantidade}</td>
              <td style={{ border: '1px solid #ccc', padding: 8, textAlign: 'right' }}>{a.valor.toFixed(2)}</td>
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
            <strong>{new Date(f.invoice_date).toLocaleDateString()}</strong> – Total: {f.total.toFixed(2)} €
            <button
              style={{ marginLeft: 15 }}
              onClick={(e) => {
                e.stopPropagation();
                deleteInvoice(f.id);
              }}
            >
              Apagar
            </button>
          </li>
        ))}
      </ul>

      {selectedInvoice && (
        <div style={{ marginTop: 20, padding: 10, border: '1px solid #ccc' }}>
          <h3>Detalhes da Fatura</h3>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ backgroundColor: '#eee' }}>
                <th style={{ border: '1px solid #ccc', padding: 8 }}>Artigo</th>
                <th style={{ border: '1px solid #ccc', padding: 8 }}>Quantidade</th>
                <th style={{ border: '1px solid #ccc', padding: 8 }}>Preço (€)</th>
                <th style={{ border: '1px solid #ccc', padding: 8 }}>Editar</th>
              </tr>
            </thead>
            <tbody>
              {selectedInvoice.items.map((item) => (
                <EditableItemRow key={item.id} item={item} onSave={saveItemChanges} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function EditableItemRow({ item, onSave }) {
  const [editMode, setEditMode] = useState(false);
  const [quantidade, setQuantidade] = useState(item.quantidade);
  const [preco, setPreco] = useState(item.preco);

  return (
    <tr>
      <td style={{ border: '1px solid #ccc', padding: 8 }}>{item.nome}</td>
      <td style={{ border: '1px solid #ccc', padding: 8, textAlign: 'center' }}>
        {editMode ? (
          <input
            type="number"
            value={quantidade}
            onChange={(e) => setQuantidade(parseInt(e.target.value))}
            style={{ width: 60 }}
          />
        ) : (
          quantidade
        )}
      </td>
      <td style={{ border: '1px solid #ccc', padding: 8, textAlign: 'right' }}>
        {editMode ? (
          <input
            type="number"
            step="0.01"
            value={preco}
            onChange={(e) => setPreco(parseFloat(e.target.value))}
            style={{ width: 80 }}
          />
        ) : (
          preco.toFixed(2)
        )}
      </td>
      <td style={{ border: '1px solid #ccc', padding: 8, textAlign: 'center' }}>
        {editMode ? (
          <>
            <button
              onClick={() => {
                onSave(item.id, quantidade, preco);
                setEditMode(false);
              }}
            >
              Guardar
            </button>
            <button onClick={() => setEditMode(false)}>Cancelar</button>
          </>
        ) : (
          <button onClick={() => setEditMode(true)}>Editar</button>
        )}
      </td>
    </tr>
  );
}
