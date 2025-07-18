import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'AQUI_A_TUA_URL_DO_SUPABASE';
const supabaseKey = 'AQUI_A_TUA_ANON_KEY';
const supabase = createClient(supabaseUrl, supabaseKey);

export async function handler() {
  try {
    // Total por mês
    const { data: invoices } = await supabase.from('invoices').select('invoice_date,total');

    // Agrupar por mês
    const monthlyTotals = {};
    invoices.forEach(inv => {
      const month = inv.invoice_date.slice(0, 7); // YYYY-MM
      monthlyTotals[month] = (monthlyTotals[month] || 0) + Number(inv.total);
    });

    // Artigos mais comprados
    const { data: items } = await supabase.from('invoice_items').select('nome, quantidade, preco');
    const artigosMap = {};
    items.forEach(it => {
      if (!artigosMap[it.nome]) {
        artigosMap[it.nome] = { quantidade: 0, total: 0 };
      }
      artigosMap[it.nome].quantidade += it.quantidade;
      artigosMap[it.nome].total += it.quantidade * Number(it.preco);
    });

    return {
      statusCode: 200,
      body: JSON.stringify({ monthlyTotals, artigos: artigosMap })
    };
  } catch (err) {
    console.error('Erro ao obter stats:', err);
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
}
