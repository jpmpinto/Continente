import React, { useEffect, useState } from 'react';
import { supabase } from './supabaseClient';

export default function App() {
  const [user, setUser] = useState(null);
  const [email, setEmail] = useState('');
  const [loadingAuth, setLoadingAuth] = useState(false);

  const [artigos, setArtigos] = useState([]);
  const [totalFatura, setTotalFatura] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [faturas, setFaturas] = useState([]);
  const [loadingFaturas, setLoadingFaturas] = useState(false);

  // Autenticação e monitorização de sessão
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setUser(data.session?.user ?? null));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  // Carregar faturas do user
  useEffect(() => {
    if (!user) {
      setFaturas([]);
      return;
    }
    fetchFaturas();
  }, [user]);

  async function fetchFaturas() {
    setLoadingFaturas(true);
    const { data, error } = await supabase
      .from('invoices')
      .select('id, invoice_date, total')
      .eq('user_id', user.id)
      .order('invoice_date', { ascending: false });
    if (error) {
      console.error('Erro ao carregar faturas:', error);
      setError('Erro ao carregar faturas');
    } else {
      setFaturas(data);
      setError('');
    }
    setLoadingFaturas(false);
  }

  // Login com magic link
  const handleLogin = async () => {
    setLoadingAuth(true);
    const { error } = await supabase.auth.signInWithOtp({ email });
    if (error) alert('Erro no login: ' + error.message);
    else alert('Email enviado para login!');
    setLoadingAuth(false);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  // Guardar fatura e artigos no supabase
  const saveInvoiceToSupabase = async (artigos, total) => {
    try {
      const { data: invoice, error: invoiceError } = await supabase
        .from('invoices')
        .insert([{ total, user_id: user.id, invoice_date: new Date().toISOString().slice(0, 10) }])
        .select()
        .single();

      if (invoiceError) throw invoiceError;

      const itemsToInsert = artigos.map((art) => ({
        invoice_id: invoice.id,
        nome: art.nome,
        quantidade: art.quantidade,
        preco: art.preco,
      }));

      const { error: itemsError } = await supabase.from('invoice_items').insert(itemsToInsert);
      if (itemsError) throw itemsError;

      alert('Fatura guardada com sucesso!');
      fetchFaturas();
    } catch (error) {
      console.error('Erro ao guardar no Supabase:', error);
      alert('Erro ao guardar fatura. Ver consola.');
    }
  };

  // Upload e processamento do PDF
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

          setArtigos(data.artigos || []);
          setTotalFatura(data.totalFatura || 0);

          await saveInvoiceToSupabase(data.artigos || [], data.totalFatura || 0);
        } catch (err) {
          console.error('Erro ao processar fatura:', err);
          setError('Erro ao processar fatura. Ver consola para detalhes.');
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

  if (!user) {
    return (
      <div style={{ padding: 20 }}>
        <h2>Login</h2>
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={loadingAuth}
        />
        <button onClick={handleLogin} disabled={!email || loadingAuth}>
          {loadingAuth ? 'A enviar...' : 'Enviar email para login'}
        </button>
        {error && <p style={{ color: 'red' }}>{error}</p>}
      </div>
    );
  }

  return (
    <div style={{ padding: 20, fontFamily: 'Arial, sans-serif' }}>
      <h1>Olá, {user.email}</h1>
      <button onClick={handleLogout} style={{ marginBottom: 20 }}>
        Logout
      </button>

      <h2>📄 Carregar Fatura Continente</h2>
      <input type="file" accept="application/pdf" onChange={handleFileUpload} disabled={loading} />
      {loading && <p>A processar fatura...</p>}
      {error && <p style={{ color: 'red' }}>{error}</p>}

      {artigos.length > 0 && (
        <div style={{ marginTop: 20 }}>
          <h3>Lista de Artigos da Última Fatura</h3>
          <table
            style={{
              width: '100%',
              borderCollapse: 'collapse',
              marginTop: 10,
            }}
          >
            <thead>
              <tr style={{ backgroundColor: '#f0f0f0' }}>
                <th style={{ border: '1px solid #ccc', padding: 8 }}>Artigo</th>
                <th style={{ border: '1px solid #ccc', padding: 8 }}>Quantidade</th>
                <th style={{ border: '1px solid #ccc', padding: 8, textAlign: 'right' }}>Preço (€)</th>
              </tr>
            </thead>
            <tbody>
              {artigos.map((art, idx) => (
                <tr key={idx}>
                  <td style={{ border: '1px solid #ccc', padding: 8 }}>{art.nome}</td>
                  <td style={{ border: '1px solid #ccc', padding: 8, textAlign: 'center' }}>{art.quantidade}</td>
                  <td style={{ border: '1px solid #ccc', padding: 8, textAlign: 'right' }}>{art.preco.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <h3 style={{ marginTop: 20 }}>
            💰 <strong>Total da Fatura: {totalFatura.toFixed(2)} €</strong>
          </h3>
        </div>
      )}

      <hr style={{ margin: '40px 0' }} />

      <h2>Faturas Guardadas</h2>
      {loadingFaturas && <p>A carregar faturas...</p>}
      {faturas.length === 0 && !loadingFaturas && <p>Não existem faturas guardadas.</p>}
      {faturas.length > 0 && (
        <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 10 }}>
          <thead>
            <tr style={{ backgroundColor: '#f0f0f0' }}>
              <th style={{ border: '1px solid #ccc', padding: 8 }}>ID</th>
              <th style={{ border: '1px solid #ccc', padding: 8 }}>Data</th>
              <th style={{ border: '1px solid #ccc', padding: 8, textAlign: 'right' }}>Total (€)</th>
            </tr>
          </thead>
          <tbody>
            {faturas.map((fat) => (
              <tr key={fat.id}>
                <td style={{ border: '1px solid #ccc', padding: 8, fontSize: 12 }}>{fat.id}</td>
                <td style={{ border: '1px solid #ccc', padding: 8 }}>{fat.invoice_date}</td>
                <td style={{ border: '1px solid #ccc', padding: 8, textAlign: 'right' }}>{parseFloat(fat.total).toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
