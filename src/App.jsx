import { useState, useEffect } from 'react';

export default function App() {
  const [file, setFile] = useState(null);
  const [stats, setStats] = useState([]);

  async function upload() {
    if (!file) return alert('Escolhe um PDF');
    const base64 = await toBase64(file);
    await fetch('/api/process-invoice', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pdfBase64: base64.split(',')[1] })
    });
    loadStats();
  }

  async function loadStats() {
    const res = await fetch('/api/get-stats');
    const data = await res.json();
    setStats(data.stats);
  }

  useEffect(() => {
    loadStats();
  }, []);

  return (
    <div style={{padding:20}}>
      <h1>Faturas Continente</h1>
      <input type="file" accept="application/pdf" onChange={e => setFile(e.target.files[0])} />
      <button onClick={upload}>Enviar</button>

      <h2>Artigos mais comprados</h2>
      <table border="1" cellPadding="8">
        <thead>
          <tr>
            <th>Artigo</th>
            <th>Qtd</th>
            <th>Total €</th>
          </tr>
        </thead>
        <tbody>
          {stats.map((s,i) => (
            <tr key={i}>
              <td>{s.nome}</td>
              <td>{s.quantidade}</td>
              <td>{s.gasto.toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function toBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
  });
}
