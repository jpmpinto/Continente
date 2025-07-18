import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';

export default function App() {
  const [artigos, setArtigos] = useState([]);
  const [totalFatura, setTotalFatura] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [invoices, setInvoices] = useState([]);
  const [uploadLoading, setUploadLoading] = useState(false);

  // Buscar faturas guardadas e artigos
  const fetchInvoices = async () => {
    setLoading(true);
    setError('');
    try {
      let { data: invoicesData, error: invoicesError } = await supabase
        .from('invoices')
        .select('id, invoice_date, total, invoice_items(*)')
        .order('invoice_date', { ascending: false });

      if (invoicesError) throw invoicesError;
      setInvoices(invoicesData || []);
    } catch (err) {
      setError('Erro ao buscar faturas: ' + err.message);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchInvoices();
  }, []);

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    setUploadLoading(true);
    setError('');
    setArtigos([]);
    setTotalFatura(0);

    try {
      const reader = new FileReader();
      reader.onload = async () => {
        const base64 = reader.result.split(',')[1];

        const response = await fetch('/.netlify/functions/process-invoice', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pdfBase64: base64 }),
        });

        if (!response.ok) {
          setError('Erro na API ao processar fatura: ' + response.status);
          setUploadLoading(false);
          return;
        }

        const data = await response.json();
        const { artigos: parsedArtigos, totalFatura } = data;

        // Filtrar artigos: manter só os que têm quantidade inteira (descarta kg como 2,334)
        const artigosFiltrados = parsedArtigos.filter((art) => {
          const q = String(art.quantidade).replace(/\./g, '').replace(',', '.');
          const qtdNumber = Number(q);
          return Number.isInteger(qtdNumber) && qtdNumber > 0;
        });

        setArtigos(artigosFiltrados);
        setTotalFatura(totalFatura);

        // Guardar fatura no Supabase
        const { data: insertedInvoice, error: invoiceError } = await supabase
          .from('invoices')
          .insert([{ invoice_date: new Date().toISOString().split('T')[0], total: totalFatura }])
          .select()
          .single();

        if (invoiceError) {
          setError('Erro ao guardar fatura: ' + invoiceError.message);
          setUploadLoading(false);
          return;
        }

        // Preparar artigos para inserção, convertendo quantidade para inteiro e preco para float
        const itemsToInsert = artigosFiltrados.map((art) => ({
          invoice_id: insertedInvoice.id,
          nome: art.nome,
          quantidade: parseInt(String(art.quantidade).replace(/\./g, ''), 10) || 1,
          preco: art.preco,
        }));

        const { error: itemsError } = await supabase.from('invoice_items').insert(itemsToInsert);
        if (itemsError) {
          setError('Erro ao guardar artigos: ' + itemsError.message);
          setUploadLoading(false);
          return;
        }

        alert('Fatura guardada com sucesso!');
        setUploadLoading(false);
        fetchInvoices();
      };
      reader.readAsDataURL(file);
    } catch (err) {
      setError('Erro ao ler ficheiro.');
      console.error(err);
      setUploadLoading(false);
    }
  };

  // Função para apagar uma fatura (com todos os artigos)
  const handleDeleteInvoice = async (invoiceId) => {
    if (!window.confirm('Tem a certeza que quer apagar esta fatura e todos os seus artigos?')) return;

    setLoading(true);
    setError('');
    try {
      const { error: deleteError } = await supabase.from('invoices').delete().eq('id', invoiceId);
      if (deleteError) throw deleteError;
      alert('Fatura apagada com sucesso!');
      fetchInvoices();
    } catch (err) {
      setError('Erro ao apagar fatura: ' + err.message);
    }
    setLoading(false);
  };

  // Função para apagar um artigo individual
  const handleDeleteItem = async (itemId) => {
    if (!window.confirm('Tem a certeza que quer apagar este artigo?')) return;

    setLoading(true);
    setError('');
    try {
      const { error: deleteError } = await supabase.from('invoice_items').delete().eq('id', itemId);
      if (deleteError) throw deleteError;
      alert('Artigo apagado com sucesso!');
      fetchInvoices();
    } catch (err) {
      setError('Erro ao apagar artigo: ' + err.message);
    }
    setLoading(false);
  };

  return (
    <div style={{ padding: '20px', fontFamily: 'Arial, sans-serif' }}>
      <h1>📄 Carregar Fatura Continente</h1>

      <input
        type="file"
        accept="application/pdf"
        onChange={handleFileUpload}
        disabled={uploadLoading}
        style={{ marginBottom: '20px' }}
      />
      {uploadLoading && <p>A processar fatura...</p>}
      {error && <p style={{ color: 'red' }}>{error}</p>}

      {artigos.length > 0 && (
        <div style={{ marginBottom: '40px' }}>
          <h2>🛒 Lista de Artigos da Última Fatura (apenas com quantidades inteiras)</h2>
          <table
            style={{
              width: '100%',
              borderCollapse: 'collapse',
              marginTop: '10px',
            }}
          >
            <thead>
              <tr style={{ backgroundColor: '#f0f0f0' }}>
                <th style={{ border: '1px solid #ccc', padding: '8px' }}>Artigo</th>
                <th style={{ border: '1px solid #ccc', padding: '8px' }}>Quantidade</th>
                <th style={{ border: '1px solid #ccc', padding: '8px' }}>Preço (€)</th>
              </tr>
            </thead>
            <tbody>
              {artigos.map((art, idx) => (
                <tr key={idx}>
                  <td style={{ border: '1px solid #ccc', padding: '8px' }}>{art.nome}</td>
                  <td style={{ border: '1px solid #ccc', padding: '8px', textAlign: 'center' }}>
                    {art.quantidade}
                  </td>
                  <td style={{ border: '1px solid #ccc', padding: '8px', textAlign: 'right' }}>
                    {art.preco.toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <h3 style={{ marginTop: '20px' }}>
            💰 <strong>Total da Fatura: {totalFatura.toFixed(2)} €</strong>
          </h3>
        </div>
      )}

      <h2>📋 Faturas Guardadas</h2>
      {loading && <p>A carregar faturas...</p>}
      {invoices.length === 0 && !loading && <p>Não existem faturas guardadas.</p>}

      {invoices.map((invoice) => (
        <div
          key={invoice.id}
          style={{
            border: '1px solid #ddd',
            borderRadius: '5px',
            marginBottom: '15px',
            padding: '10px',
          }}
        >
          <p>
            <strong>Data:</strong> {invoice.invoice_date} | <strong>Total:</strong>{' '}
            {invoice.total.toFixed(2)} €
          </p>

          <button
            onClick={() => handleDeleteInvoice(invoice.id)}
            style={{
              marginBottom: '10px',
              backgroundColor: '#e74c3c',
              color: 'white',
              border: 'none',
              padding: '6px 12px',
              borderRadius: '4px',
              cursor: 'pointer',
            }}
          >
            Apagar Fatura
          </button>

          <details>
            <summary>Ver artigos</summary>
            <table
              style={{
                width: '100%',
                borderCollapse: 'collapse',
                marginTop: '10px',
              }}
            >
              <thead>
                <tr style={{ backgroundColor: '#f0f0f0' }}>
                  <th style={{ border: '1px solid #ccc', padding: '8px' }}>Artigo</th>
                  <th style={{ border: '1px solid #ccc', padding: '8px' }}>Quantidade</th>
                  <th style={{ border: '1px solid #ccc', padding: '8px' }}>Preço (€)</th>
                  <th style={{ border: '1px solid #ccc', padding: '8px' }}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {invoice.invoice_items.map((item) => (
                  <tr key={item.id}>
                    <td style={{ border: '1px solid #ccc', padding: '8px' }}>{item.nome}</td>
                    <td style={{ border: '1px solid #ccc', padding: '8px', textAlign: 'center' }}>
                      {item.quantidade}
                    </td>
                    <td style={{ border: '1px solid #ccc', padding: '8px', textAlign: 'right' }}>
                      {item.preco.toFixed(2)}
                    </td>
                    <td style={{ border: '1px solid #ccc', padding: '8px', textAlign: 'center' }}>
                      <button
                        onClick={() => handleDeleteItem(item.id)}
                        style={{
                          backgroundColor: '#e74c3c',
                          color: 'white',
                          border: 'none',
                          padding: '4px 8px',
                          borderRadius: '4px',
                          cursor: 'pointer',
                        }}
                      >
                        Apagar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </details>
        </div>
      ))}
    </div>
  );
}
