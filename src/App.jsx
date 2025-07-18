import React, { useEffect, useState } from 'react';
import { supabase } from './supabaseClient';

// 🔎 Função para normalizar nomes semelhantes
function normalizarNome(nomeOriginal) {
  const n = nomeOriginal.toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  if (n.includes('ATUM') && n.includes('OLEO') && n.includes('85')) {
    return 'ATUM OLEO 85G CONTINENTE';
  }
  // Adiciona outras regras se quiseres

  return nomeOriginal;
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

  // Datas para filtro
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');

  // 🔑 AUTH
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });
    return () => listener?.subscription.unsubscribe();
  }, []);

  // 🔄 CARREGAR Faturas e Artigos Agregados
  useEffect(() => {
    if (user) {
      fetchFaturas();
    } else {
      setFaturas([]);
      setSelectedInvoice(null);
      setArtigosAgregados([]);
    }
  }, [user]);

  useEffect(() => {
    // Atualiza os artigos agregados quando datas, faturas ou sortBy mudam
    if (faturas.length) {
      fetchArtigosAgregados(faturas);
    }
  }, [dataInicio, dataFim, faturas, sortBy]);

  async function fetchFaturas() {
    if (!user) return;
    setLoadingFaturas(true);
    setError('');
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

    // Filtra faturas por intervalo de datas
    const faturasFiltradas = faturasList.filter((f) => {
      if (dataInicio && new Date(f.invoice_date) < new Date(dataInicio)) return false;
      if (dataFim && new Date(f.invoice_date) > new Date(dataFim)) return false;
      return true;
    });

    if (faturasFiltradas.length === 0) {
      setArtigosAgregados([]);
      return;
    }

    try {
      const invoiceIds = faturasFiltradas.map((f) => f.id);
      const { data: itens, error } = await supabase
        .from('invoice_items')
        .select('id, nome, quantidade, preco')
        .in('invoice_id', invoiceIds);
      if (error) throw error;

      const agrupados = {};
      itens.forEach(({ id, nome, quantidade, preco }) => {
        if (!Number.isInteger(quantidade)) return;

        const nomeNormalizado = normalizarNome(nome);
        if (!agrupados[nomeNormalizado]) {
          agrupados[nomeNormalizado] = { nome: nomeNormalizado, quantidade: 0, valor: 0, ids: [] };
        }
        agrupados[nomeNormalizado].quantidade += quantidade;
        agrupados[nomeNormalizado].valor += preco;
        agrupados[nomeNormalizado].ids.push(id); // guardar ids para edição
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

  function changeSort(by) {
    setSortBy(by);
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

  async function deleteItem(itemId) {
    if (!window.confirm('Tem a certeza que quer apagar este artigo?')) return;
    try {
      const { error } = await supabase.from('invoice_items').delete().eq('id', itemId);
      if (error) throw error;
      openInvoice(selectedInvoice.id);
      fetchFaturas();
    } catch (err) {
      console.error('❌ Erro ao apagar artigo:', err);
      setError('Erro ao apagar artigo: ' + err.message);
    }
  }

  async function handleFileUpload(event) {
    const files = Array.from(event.target.files);
    if (!files.length) return;

    setUploadLoading(true);
    try {
      for (const file of files) {
        await processSingleFile(file);
      }
      alert('Todas as faturas foram processadas!');
    } catch (err) {
      console.error('❌ Erro ao processar fatura:', err);
      setError('Erro ao processar fatura: ' + err.message);
    } finally {
      setUploadLoading(false);
    }
  }

  async function processSingleFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = async () => {
        try {
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
          if (artigosValidos.length > 0) {
            const itemsToInsert = artigosValidos.map((art) => ({
              invoice_id: invoice.id,
              nome: art.nome,
              quantidade: art.quantidade,
              preco: art.preco,
            }));
            const { error: itemsError } = await supabase.from('invoice_items').insert(itemsToInsert);
            if (itemsError) throw itemsError;
          }

          fetchFaturas();
          resolve();
        } catch (err) {
          reject(err);
        }
      };
      reader.readAsDataURL(file);
    });
  }

  function exportToCSV() {
    const headers = ['Artigo', 'Qtd Total', 'Valor Total (€)'];
    const rows = artigosAgregados.map((a) => [a.nome, a.quantidade, a.valor.toFixed(2)]);
    const csvContent =
      [headers, ...rows].map((row) => row.map((r) => `"${r}"`).join(',')).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'artigos_agregados.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  // Edição inline do nome dos artigos agregados
  async function saveNomeAgregado(oldNome, novoNome) {
    if (!novoNome.trim() || novoNome === oldNome) return;

    setError('');
    try {
      // Para simplificar, atualizamos todos os invoice_items que têm o nome antigo para o novo
      const { error } = await supabase
        .from('invoice_items')
        .update({ nome: novoNome })
        .ilike('nome', oldNome);
      if (error) throw error;

      // Depois refetch dos faturas para atualizar
      fetchFaturas();
    } catch (err) {
      console.error('❌ Erro ao atualizar nome do artigo agregado:', err);
      setError('Erro ao atualizar nome do artigo: ' + err.message);
    }
  }

  const artigosFiltrados = artigosAgregados.filter((a) =>
    a.nome.toLowerCase().includes(searchTerm.toLowerCase())
  );

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

      <h2>Carregar novas faturas</h2>
      <input
        type="file"
        accept="application/pdf"
        multiple
        onChange={handleFileUpload}
        disabled={uploadLoading}
      />
      {uploadLoading && <p>A carregar faturas...</p>}
      {error && <p style={{ color: 'red' }}>{error}</p>}

      <h2>Filtro por datas das faturas</h2>
      <div style={{ marginBottom: 15 }}>
        <label>
          Data Início:{' '}
          <input
            type="date"
            value={dataInicio}
            onChange={(e) => setDataInicio(e.target.value)}
          />
        </label>
        <label style={{ marginLeft: 20 }}>
          Data Fim:{' '}
          <input
            type="date"
            value={dataFim}
            onChange={(e) => setDataFim(e.target.value)}
          />
        </label>
        <button
          style={{ marginLeft: 20 }}
          onClick={() => {
            setDataInicio('');
            setDataFim('');
          }}
        >
          Limpar filtro
        </button>
      </div>

      <h2>Artigos agregados</h2>
      <input
        type="text"
        placeholder="Pesquisar artigo..."
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        style={{ marginBottom: 10, padding: 5, width: '100%' }}
      />
      <div style={{ marginBottom: 10 }}>
        <button onClick={() => changeSort('quantidade')} disabled={sortBy === 'quantidade'}>
          Ordenar por Quantidade
        </button>
        <button onClick={() => changeSort('valor')} disabled={sortBy === 'valor'}>
          Ordenar por Valor
        </button>
        <button style={{ marginLeft: 10 }} onClick={exportToCSV}>
          Exportar CSV
        </button>
      </div>
      <table style={{ width: '100%', marginTop: 10, marginBottom: 30, borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ backgroundColor: '#eee' }}>
            <th style={{ border: '1px solid #ccc', padding: 8 }}>Artigo (editar inline)</th>
            <th style={{ border: '1px solid #ccc', padding: 8, textAlign: 'right' }}>Qtd Total</th>
            <th style={{ border: '1px solid #ccc', padding: 8, textAlign: 'right' }}>Valor Total (€)</th>
          </tr>
        </thead>
        <tbody>
          {artigosFiltrados.map((a) => (
            <EditableAgregadoRow key={a.nome} artigo={a} onSaveNome={saveNomeAgregado} />
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
                <th style={{ border: '1px solid #ccc', padding: 8 }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {selectedInvoice.items.map((item) => (
                <EditableItemRow
                  key={item.id}
                  item={item}
                  onSave={saveItemChanges}
                  onDelete={deleteItem}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// Linha editável do agregado, só o nome editável inline
function EditableAgregadoRow({ artigo, onSaveNome }) {
  const [editMode, setEditMode] = useState(false);
  const [nomeEdit, setNomeEdit] = useState(artigo.nome);

  return (
    <tr>
      <td style={{ border: '1px solid #ccc', padding: 8 }}>
        {editMode ? (
          <>
            <input
              type="text"
              value={nomeEdit}
              onChange={(e) => setNomeEdit(e.target.value)}
              style={{ width: '100%' }}
            />
            <div style={{ marginTop: 4 }}>
              <button
                onClick={() => {
                  onSaveNome(artigo.nome, nomeEdit);
                  setEditMode(false);
                }}
                disabled={!nomeEdit.trim() || nomeEdit === artigo.nome}
              >
                Guardar
              </button>
              <button onClick={() => {
                setNomeEdit(artigo.nome);
                setEditMode(false);
              }} style={{ marginLeft: 8 }}>
                Cancelar
              </button>
            </div>
          </>
        ) : (
          <>
            {artigo.nome}
            <button
              style={{ marginLeft: 8 }}
              onClick={() => setEditMode(true)}
              title="Editar nome"
            >
              ✎
            </button>
          </>
        )}
      </td>
      <td style={{ border: '1px solid #ccc', padding: 8, textAlign: 'right' }}>{artigo.quantidade}</td>
      <td style={{ border: '1px solid #ccc', padding: 8, textAlign: 'right' }}>{artigo.valor.toFixed(2)}</td>
    </tr>
  );
}

// Linha editável dos itens da fatura
function EditableItemRow({ item, onSave, onDelete }) {
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
          <>
            <button onClick={() => setEditMode(true)}>Editar</button>
            <button style={{ marginLeft: 8 }} onClick={() => onDelete(item.id)}>
              Apagar
            </button>
          </>
        )}
      </td>
    </tr>
  );
}
