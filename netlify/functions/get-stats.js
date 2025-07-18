const SUPABASE_URL = 'https://TEU_PROJETO.supabase.co/rest/v1/';
const SUPABASE_KEY = 'A_TUA_ANON_PUBLIC_KEY';

exports.handler = async () => {
  try {
    // Buscar todas as faturas
    const invRes = await fetch(`${SUPABASE_URL}invoices?select=invoice_date,total`, {
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`
      }
    });
    const invoices = await invRes.json();
    if (!invRes.ok) throw new Error(JSON.stringify(invoices));

    // Agrupar total gasto por mês
    const monthlyTotals = {};
    invoices.forEach(inv => {
      const month = inv.invoice_date.slice(0, 7); // YYYY-MM
      monthlyTotals[month] = (monthlyTotals[month] || 0) + Number(inv.total);
    });

    // Buscar todos os artigos
    const itemsRes = await fetch(`${SUPABASE_URL}invoice_items?select=nome,quantidade,preco`, {
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`
      }
    });
    const items = await itemsRes.json();
    if (!itemsRes.ok) throw new Error(JSON.stringify(items));

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
    console.error('Erro ao buscar stats:', err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message })
    };
  }
};
