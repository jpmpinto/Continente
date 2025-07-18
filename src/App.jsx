import { useState } from 'react'

export default function App() {
  const [file, setFile] = useState(null)

  async function handleUpload() {
    if (!file) return alert('Escolhe um PDF primeiro.')
    const base64 = await toBase64(file)
    const response = await fetch('/api/process-invoice', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pdfBase64: base64.split(',')[1] })
    })
    const data = await response.json()
    console.log(data)
    alert(JSON.stringify(data, null, 2))
  }

  const toBase64 = file => new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.readAsDataURL(file)
    reader.onload = () => resolve(reader.result)
    reader.onerror = error => reject(error)
  })

  return (
    <div style={{ padding: 20 }}>
      <h1>Upload Fatura Continente</h1>
      <input type="file" accept="application/pdf" onChange={e => setFile(e.target.files[0])} />
      <button onClick={handleUpload}>Enviar</button>
    </div>
  )
}
