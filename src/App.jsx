import React, { useEffect, useState } from 'react';
import { supabase } from './supabaseClient';

export default function App() {
  const [invoices, setInvoices] = useState([]);
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [uploadLoading, setUploadLoading] = useState(false);
  const [error, setError] = useState('');

  // Buscar faturas ao carregar
  useEffect(() => {
    fetchInvoices();
  }, []);

  async function fetchInvoices() {
    setLoading(true);
    const { data, error } = await supabase
      .from('invoices')
      .select('id, invoice_date, total')
      .order('invoice_date', { ascending: false });
    if (error) {
      alert('Erro a buscar faturas: ' + error.message);
    } else {
      setInvoices(data);
    }
    setLoading(false);
  }

  async function fetchInvoiceItems(invoiceId) {
    setLoading(true);
    const { data, error } = await supabase
      .from('invoice_items')
      .select('id, nome, quantidade, preco')
      .eq('invoice_id', invoiceId);
    if (error) {
      alert('Erro a buscar artigos: ' + error.message);
      setItems([]);
    } else {
      setItems(data);
    }
    setLoading(false);
  }

  function openInvoiceDetails(invoice) {
    setSelectedInvoice(invoice);
    fetchInvoiceItems(invoice.id);
  }

  function closeInvoiceDetails() {
    setSelectedInvoice(null);
    setItems([]);
  }

  // Apagar fatura com confirmação
  async function deleteInvoice(id) {
    if (!window.confirm('Tem a certeza que deseja apagar esta fatura? Esta ação não pode ser desfeita.')) {
      return;
    }
    setLoading(true);
    const { error } = await supabase
      .from('invoices')
      .delete()
      .eq('id', id);
    if (error) {
      alert('Erro ao apagar fatura: ' + error.message);
    } else {
      alert('Fatura apagada com sucesso!');
      fetchInvoices();
      if (selectedInvoice?.id === id) {
        closeInvoiceDetails();
      }
    }
    setLoading(false);
  }

  // Upload e processamento PDF
  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    setUploadLoading(true);
    setError('');
    
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

        // Guardar no Supabase
        const { artigos, totalFatura } = data;

        // Insere fatura
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

        // Insere artigos
        const itemsToInsert = artigos.map((art) => ({
          invoice_id: insertedInvoice.id,
          nome: art.nome,
          quantidade: art.quantidade,
          preco: art.preco,
        }));

        const { error: itemsError } = await supabase.from('invoice_items').insert(itemsToInsert);
        if (itemsError) {
          setError('Erro ao guardar artigos: ' + itemsError.message);
          setUploadLoading(false);
          return;
        }

        alert('Fatura guardada com sucesso!');
        fetchInvoices();
      };
      reader.readAsDataURL(file);
    } catch (err) {
      setError('Erro ao ler ficheiro.');
      console.error(err);
    } finally {
      setUploadLoading(false);
    }
  };

  return (
    <div style={{ padding: 20, fontFamily: 'Arial, sans-serif' }}>
      <h1>📄 Gestão de Faturas Continente</h1>

      {/* Upload PDF */}
      <div style={{ marginBottom: 20 }}>
        <label>
          <strong>Carregar nova fatura (PDF): </strong>
          <input type="file" accept="application/pdf" onChange={handleFileUpload} disabled={uploadLoading} />
        </label>
        {uploadLoading && <p>Processando fatura...</p>}
        {error && <p style={{ color: 'red' }}>{error}</p>}
      </div>

      {/* Lista faturas */}
      {loading && <p>Carregando faturas...</p>}
      {!loading && invoices.length === 0 && <p>Nenhuma fatura encontrada.</p>}
      {!loading && invoices.length > 0 && (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ backgroundColor: '#eee' }}>
              <th style={{ border: '1px solid #ccc', padding: 8 }}>Data</th>
              <th style={{ border: '1px solid #ccc', padding: 8 }}>Total (€)</th>
              <th style={{ border: '1px solid #ccc', padding: 8 }}>Ações</th>
            </tr>
          </thead>
          <tbody>
            {invoices.map(inv => (
              <tr key={inv.id}>
                <td style={{ border: '1px solid #ccc', padding: 8 }}>{new Date(inv.invoice_date).toLocaleDateString()}</td>
                <td style={{ border: '1px solid #ccc', padding: 8, textAlign: 'right' }}>{inv.total.toFixed(2)}</td>
                <td style={{ border: '1px solid #ccc', padding: 8 }}>
                  <button onClick={() => openInvoiceDetails(inv)} style={{ marginRight: 10 }}>
                    Ver detalhes
                  </button>
                  <button onClick={() => deleteInvoice(inv.id)} style={{ color: 'red' }}>
                    Apagar
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* Modal detalhes */}
      {selectedInvoice && (
        <div
          style={{
            position: 'fixed',
            top: 20,
            left: '50%',
            transform: 'translateX(-50%)',
            backgroundColor: '#fff',
            padding: 20,
            boxShadow: '0 0 10px rgba(0,0,0,0.3)',
            zIndex: 1000,
            maxWidth: 600,
            width: '90%',
          }}
        >
          <h2>Detalhes da Fatura - {new Date(selectedInvoice.invoice_date).toLocaleDateString()}</h2>
          <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 10 }}>
            <thead>
              <tr style={{ backgroundColor: '#eee' }}>
                <th style={{ border: '1px solid #ccc', padding: 8 }}>Artigo</th>
                <th style={{ border: '1px solid #ccc', padding: 8 }}>Quantidade</th>
                <th style={{ border: '1px solid #ccc', padding: 8 }}>Preço (€)</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 && (
                <tr>
                  <td colSpan="3" style={{ textAlign: 'center', padding: 10 }}>
                    Sem artigos para esta fatura.
                  </td>
                </tr>
              )}
              {items.map(item => (
                <tr key={item.id}>
                  <td style={{ border: '1px solid #ccc', padding: 8 }}>{item.nome}</td>
                  <td style={{ border: '1px solid #ccc', padding: 8, textAlign: 'center' }}>{item.quantidade}</td>
                  <td style={{ border: '1px solid #ccc', padding: 8, textAlign: 'right' }}>{item.preco.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <button style={{ marginTop: 20 }} onClick={closeInvoiceDetails}>
            Fechar
          </button>
        </div>
      )}
    </div>
  );
}
