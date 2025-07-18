import React, { useEffect, useState } from 'react';
import { supabase } from './supabaseClient';

export default function App() {
  const [invoices, setInvoices] = useState([]);
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);

  // Fetch invoices on mount
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

  // Fetch items for a selected invoice
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

  return (
    <div style={{ padding: 20, fontFamily: 'Arial, sans-serif' }}>
      <h1>📄 Lista de Faturas Guardadas</h1>
      {loading && <p>Carregando...</p>}
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
                  <button onClick={() => openInvoiceDetails(inv)}>Ver detalhes</button>
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
                  <td colSpan="3" style={{ textAlign: 'center', padding: 10 }}>Sem artigos para esta fatura.</td>
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
          <button style={{ marginTop: 20 }} onClick={closeInvoiceDetails}>Fechar</button>
        </div>
      )}
    </div>
  );
}
