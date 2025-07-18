const SUPABASE_URL = https://tmibztgvgnfjkkzaolgc.supabase.co/;
const SUPABASE_KEY = eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRtaWJ6dGd2Z25mamtremFvbGdjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI4NDk2MDcsImV4cCI6MjA2ODQyNTYwN30.oiNVXw8mn9ft4qpnih7bwoCTJyB_jEWUopXzMwJr8Oc;

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method Not Allowed' }),
    };
  }

  try {
    const { invoiceDate, total, artigos } = JSON.parse(event.body);

    // 1. Inserir a fatura
    const invoiceRes = await fetch(`${SUPABASE_URL}invoices`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Prefer': 'return=representation'
      },
      body: JSON.stringify([{ invoice_date: invoiceDate, total }])
    });

    const invoiceData = await invoiceRes.json();
    if (!invoiceRes.ok) throw new Error(JSON.stringify(invoiceData));

    const invoiceId = invoiceData[0].id;

    // 2. Preparar artigos
    const items = artigos.map(a => ({
      invoice_id: invoiceId,
      nome: a.nome,
      preco: a.preco,
      quantidade: a.quantidade
    }));

    if (items.length > 0) {
      const itemsRes = await fetch(`${SUPABASE_URL}invoice_items`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`
        },
        body: JSON.stringify(items)
      });

      const itemsData = await itemsRes.json();
      if (!itemsRes.ok) throw new Error(JSON.stringify(itemsData));
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ success: true })
    };
  } catch (err) {
    console.error('Erro ao guardar fatura:', err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message })
    };
  }
};
