import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'AQUI_A_TUA_URL_DO_SUPABASE';
const supabaseKey = 'AQUI_A_TUA_ANON_KEY';
const supabase = createClient(supabaseUrl, supabaseKey);

export async function handler(event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const body = JSON.parse(event.body);
    const { invoiceDate, total, artigos } = body;

    // 1. Inserir a fatura
    const { data: invoice, error: invErr } = await supabase
      .from('invoices')
      .insert([{ invoice_date: invoiceDate, total }])
      .select()
      .single();

    if (invErr) throw invErr;

    // 2. Inserir os artigos
    const items = artigos.map(a => ({
      invoice_id: invoice.id,
      nome: a.nome,
      preco: a.preco,
      quantidade: a.quantidade
    }));

    const { error: itemsErr } = await supabase.from('invoice_items').insert(items);
    if (itemsErr) throw itemsErr;

    return {
      statusCode: 200,
      body: JSON.stringify({ success: true })
    };
  } catch (err) {
    console.error('Erro ao gravar fatura:', err);
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
}
