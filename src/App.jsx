import React, { useEffect, useState } from 'react';
import { supabase } from './supabaseClient';

export default function App() {
  const [user, setUser] = useState(null);
  const [faturas, setFaturas] = useState([]);
  const [loadingFaturas, setLoadingFaturas] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState(null); // fatura aberta
  const [artigosAgregados, setArtigosAgregados] = useState([]);
  const [sortBy, setSortBy] = useState('quantidade'); // 'quantidade' ou 'valor'
  const [uploadLoading, setUploadLoading] = useState(false);
  const [error, setError] = useState('');

  // 1. Autenticação: Observar user logado
  useEffect(() => {
    const session = supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) fetchFaturas();
      else {
        setFaturas([]);
        setSelectedInvoice(null);
        setArtigosAgregados([]);
      }
    });
    if (user) fetchFaturas();

    return () => {
      listener?.subscription.unsubscribe();
    };
  }, [user]);

  // 2. Buscar faturas do user logado
  async function fetchFaturas() {
    setLoadingFaturas(true);
    setError('');
    try {
      // Supondo que tens user_id na tabela invoices para filtrar
      const { data, error } = await supabase
        .from('invoices')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setFaturas(data);
      setSelectedInvoice(null);
      setArtigosAgregados([]);

      // Calcular artigos agregados (somatório de todas as faturas do user)
      await fetchArtigosAgregados(data);
    } catch (err) {
      setError('Erro a carregar faturas: ' + err.message);
    }
    setLoadingFaturas(false);
  }

  // 3. Buscar e agregar artigos de várias faturas
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

      // Agregar por nome: somar quantidade e valor
      const agrupados = {};
      itens.forEach(({ nome, quantidade, preco }) => {
        if (!agrupados[nome]) {
          agrupados[nome] = { nome, quantidade: 0, valor: 0 };
        }
        agrupados[nome].quantidade += quantidade;
        agrupados[nome].valor += preco;
      });

      let result = Object.values(agrupados);

      // Ordenar
      if (sortBy === 'quantidade') {
        result.sort((a, b) => b.quantidade - a.quantidade);
      } else {
        result.sort((a, b) => b.valor - a.valor);
      }

      setArtigosAgregados(result);
    } catch (err) {
      setError('Erro a carregar artigos agregados: ' + err.message);
    }
  }

  // 4. Selecionar fatura para detalhes
  async function openInvoice(id) {
    setError('');
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
      setError('Erro a abrir fatura: ' + err.message);
    }
  }

  // 5. Apagar fatura (com cascade apaga artigos)
  async function deleteInvoice(id) {
    if (!window.confirm('Tem a certeza que quer apagar esta fatura?')) return;
    setError('');
    try {
      const { error } = await supabase.from('invoices').delete().eq('id', id);
      if (error) throw error;
      fetchFaturas();
    } catch (err) {
      setError('Erro ao apagar fatura: ' + err.message);
    }
  }

  // 6. Editar artigos (exemplo simples, só quantidade e preço)
  async function saveItemChanges(itemId, quantidade, preco) {
    setError('');
    try {
      const { error } = await supabase
        .from('invoice_items')
        .update({ quantidade, preco })
        .eq('id', itemId);
      if (error) throw error;
      openInvoice(selectedInvoice.id); // refrescar detalhes
      fetchFaturas(); // refrescar listagem geral e agregados
    } catch (err) {
      setError('Erro ao guardar artigo: ' + err.message);
    }
  }

  // 7. Carregar nova fatura (simplificado)
  async function handleFileUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    setUploadLoading(true);
    setError('');

    try {
      const reader = new FileReader();
      reader.onload = async () => {
        const base64 = reader.result.split(',')[1];

        // Enviar para função lambda (Netlify function)
        const response = await fetch('/.netlify/functions/process-invoice', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pdfBase64: base64 }),
        });

        if (!response.ok) throw new Error(`Erro na API: ${response.status}`);

        const data = await response.json();

        // Guardar fatura e artigos com user_id no supabase
        const { totalFatura, artigos } = data;

        // Inserir fatura
        const { data: invoice, error: invoiceError } = await supabase
          .from('invoices')
          .insert([{ total: totalFatura, invoice_date: new Date(), user_id: user.id }])
          .select()
          .single();

        if (invoiceError) throw invoiceError;

        // Inserir artigos (descartar artigos com quantidade não inteira)
        const artigosValidos = artigos.filter(a => Number.isInteger(a.quantidade));

        const itemsToInsert = artigosValidos.map((art) => ({
          invoice_id: invoice.id,
          nome: art.nome,
          quantidade: art.quantidade,
          preco: art.preco,
        }));

        const { error: itemsError } = await supabase.from('invoice_items').insert(itemsToInsert);
        if (itemsError) throw itemsError;

        await fetchFaturas();

        alert('Fatura guardada com sucesso!');
      };
      reader.readAsDataURL(file);
    } catch (err) {
      setError('Erro ao processar fatura: ' + err.message);
    } finally {
      setUploadLoading(false);
    }
  }

  // 8. Ordenar agregados (alterar sortBy)
  function changeSort(by) {
    setSortBy(by);
    fetchArtigosAgregados(faturas);
  }

  if (!user)
    return (
      <div style={{ padding: 20 }}>
        <h1>Login necessário</h1>
        <button
          onClick={async () => {
            const email = prompt('Indica o teu email para receber o link mágico');
            if (!email) return alert('Email obrigatório');
            const { error } = await supabase.auth.signInWithOtp({
              email,
              options: {
                emailRedirectTo: window.location.origin,
              },
            });
            if (error) alert('Erro no login: ' + error.message);
            else alert('Email enviado! Verifica o teu email.');
          }}
        >
          Enviar email para login
        </button>
      </div>
    );

  return (
    <div style={{ padding: 20, fontFamily: 'Arial, sans-serif', maxWidth: 900, margin: 'auto' }}>
      <h1>Faturas do utilizador: {user.email}</h1>
      <button onClick={() => supabase.auth.signOut()}>Logout</button>

      <h2>Carregar nova fatura (PDF Continente)</h2>
      <input type="file" accept="application/pdf" onChange={handleFileUpload} disabled={uploadLoading} />
      {uploadLoading && <p>A carregar fatura...</p>}

      {error && <p style={{ color: 'red' }}>{error}</p>}

      <h2>Artigos agregados (somatório em todas as faturas)</h2>
      <div style={{ marginBottom: 10 }}>
        Ordenar por:{' '}
        <button disabled={sortBy === 'quantidade'} onClick={() => changeSort('quantidade')}>
          Quantidade
        </button>{' '}
        <button disabled={sortBy === 'valor'} onClick={() => changeSort('valor')}>
          Valor
        </button>
      </div>

      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 30 }}>
        <thead>
          <tr style={{ backgroundColor: '#eee' }}>
            <th style={{ border: '1px solid #ccc', padding: 8 }}>Artigo</th>
            <th style={{ border: '1px solid #ccc', padding: 8, textAlign: 'right' }}>Quantidade Total</th>
            <th style={{ border: '1px solid #ccc', padding: 8, textAlign: 'right' }}>Valor Total (€)</th>
          </tr>
        </thead>
        <tbody>
          {artigosAgregados.length === 0 && (
            <tr>
              <td colSpan={3} style={{ textAlign: 'center', padding: 20 }}>
                Sem artigos encontrados
              </td>
            </tr>
          )}
          {artigosAgregados.map(({ nome, quantidade, valor }) => (
            <tr key={nome}>
              <td style={{ border: '1px solid #ccc', padding: 8 }}>{nome}</td>
              <td style={{ border: '1px solid #ccc', padding: 8, textAlign: 'right' }}>{quantidade}</td>
              <td style={{ border: '1px solid #ccc', padding: 8, textAlign: 'right' }}>{valor.toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2>Faturas</h2>
      {loadingFaturas && <p>A carregar faturas...</p>}
      {faturas.length === 0 && !loadingFaturas && <p>Sem faturas guardadas.</p>}

      <ul style={{ listStyle: 'none', paddingLeft: 0 }}>
        {faturas.map((f) => (
          <li
            key={f.id}
            style={{
              marginBottom: 10,
              padding: 10,
              border: '1px solid #ccc',
              backgroundColor: selectedInvoice?.id === f.id ? '#def' : '#fff',
              cursor: 'pointer',
            }}
            onClick={() => openInvoice(f.id)}
          >
            <strong>Fatura de {new Date(f.invoice_date).toLocaleDateString()}</strong> - Total: {f.total.toFixed(2)} €
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
        <div style={{ marginTop: 30, padding: 10, border: '1px solid #666', backgroundColor: '#f9f9f9' }}>
          <h3>Detalhes da Fatura - {new Date(selectedInvoice.invoice_date).toLocaleDateString()}</h3>

          {selectedInvoice.items.length === 0 && <p>Sem artigos nesta fatura.</p>}

          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ backgroundColor: '#eee' }}>
                <th style={{ border: '1px solid #ccc', padding: 8 }}>Artigo</th>
                <th style={{ border: '1px solid #ccc', padding: 8, textAlign: 'center' }}>Quantidade</th>
                <th style={{ border: '1px solid #ccc', padding: 8, textAlign: 'right' }}>Preço (€)</th>
                <th style={{ border: '1px solid #ccc', padding: 8, textAlign: 'center' }}>Editar</th>
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

// Componente para linha de artigo editável
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
            min="1"
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
            min="0"
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
                if (quantidade > 0 && preco >= 0) {
                  onSave(item.id, quantidade, preco);
                  setEditMode(false);
                } else {
                  alert('Valores inválidos.');
                }
              }}
            >
              Guardar
            </button>{' '}
            <button onClick={() => setEditMode(false)}>Cancelar</button>
          </>
        ) : (
          <button onClick={() => setEditMode(true)}>Editar</button>
        )}
      </td>
    </tr>
  );
}
