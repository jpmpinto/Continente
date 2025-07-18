import React, { useState } from 'react';
import { supabase } from './supabaseClient';

export default function App() {
  // ... o resto do código mantém-se igual ...

  const saveInvoiceToSupabase = async (artigos, total) => {
    try {
      // 1. Inserir a fatura
      const { data: invoice, error: invoiceError } = await supabase
        .from('invoices')
        .insert([{ total }])
        .select()
        .single();

      if (invoiceError) throw invoiceError;

      // 2. Inserir os artigos relacionados
      const itemsToInsert = artigos.map((art) => ({
        invoice_id: invoice.id,
        nome: art.nome,
        quantidade: art.quantidade,
        preco: art.preco,
      }));

      const { error: itemsError } = await supabase.from('invoice_items').insert(itemsToInsert);
      if (itemsError) throw itemsError;

      alert('Fatura guardada com sucesso!');
    } catch (error) {
      console.error('Erro ao guardar no Supabase:', error);
      alert('Erro ao guardar fatura. Ver consola.');
    }
  };

  // Atualiza o handleFileUpload para chamar saveInvoiceToSupabase
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

        const response = await fetch('/.netlify/functions/process-invoice', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pdfBase64: base64 }),
        });

        if (!response.ok) {
          throw new Error(`Erro na API: ${response.status}`);
        }

        const data = await response.json();

        setArtigos(data.artigos || []);
        setTotalFatura(data.totalFatura || 0);

        // Guardar na base de dados
        await saveInvoiceToSupabase(data.artigos || [], data.totalFatura || 0);

        setLoading(false);
      };
      reader.readAsDataURL(file);
    } catch (err) {
      console.error('Erro ao processar fatura:', err);
      setError('Erro ao processar fatura. Ver consola para detalhes.');
      setLoading(false);
    }
  };

  // ... JSX mantém-se igual ...
}
