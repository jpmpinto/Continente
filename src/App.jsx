import React, { useState } from 'react';
import { supabase } from './supabaseClient';

export default function App() {
  const [artigos, setArtigos] = useState([]);
  const [totalFatura, setTotalFatura] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [invoiceDate, setInvoiceDate] = useState('');

  // Função para gravar no Supabase
  const saveInvoiceToSupabase = async (artigos, total) => {
    try {
      // Usa a data atual (ou podes pedir ao utilizador)
      const today = new Date().toISOString().split('T')[0];

      const { data: invoice, error: invoiceError } = await supabase
        .from('invoices')
        .insert([{ invoice_date: today, total }])
        .select()
        .single();

      if (invoiceError) throw invoiceError;

      const itemsToInsert = artigos.map((art) => ({
        invoice_id: invoice.id,
        nome: art.nome,
        preco: art.preco,
        quantidade: art.quantidade || 1,
      }));

      const { error: itemsError } = await supabase.from('invoice_items').insert(itemsToInsert);
      if (itemsError) throw itemsError;

      alert('✅ Fatura guardada com sucesso no Supabase!');
    } catch (err) {
      console.error('Erro ao guardar no Supabase:', err);
      alert('❌ Erro ao guardar fatura. Ver consola.');
    }
  };

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    setLoading(true);
    setError('');
    setArtigos([]);
    setTotalFatura(0);

    try {
      const reader = new FileReader();
      reader.onload = async () => {
        const base64 = reader.result.split(',')[1];

        try {
          const response = await fetch('/.netlify/functions/process-invoice', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ pdfBase64: base64 }),
          });

          if (!response.ok) {
            throw new Error(`Erro na API: ${response.status}`);
          }

          const data = await response.json();
          console.log('✅ Dados recebidos da API:', data);

          setArtigos(data.artigos || []);
          setTotalFatura(data.totalFatura || 0);

          // Guarda na base de dados
          await saveInvoiceToSupabase(data.artigos || [], data.totalFatura || 0);

        } catch (err) {
          console.error('Erro ao processar fatura:', err);
          setError('Erro ao processar fatura. Ver consola.');
        } finally {
          setLoading(false);
        }
      };
      reader.readAsDataURL(file);
    } catch (err) {
      console.error('Erro ao ler ficheiro:', err);
      setError('Erro ao ler ficheiro.');
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: '20px', fontFamily: 'Arial, sans-serif' }}>
      <h1>📄 Carregar Fatura Continente</h1>
      <input type="file" accept="application/pdf" onChange={handleFileUpload} />
      {loading && <p>A processar fatura...</p>}
      {error && <p style={{ color: 'red' }}>{error}</p>}

      {artigos.length > 0 && (
        <div style={{ marginTop: '20px' }}>
          <h2>🛒 Lista de Artigos</h2>
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
                    {art.quantidade || 1}
                  </td>
                  <td style={{ border: '1px solid #ccc', padding: '8px', textAlign: 'right' }}>
                    {art.preco.toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <h3 style={{ marginTop: '20px' }}>
            💰 <strong>Total da Fatura: {totalFatura.
