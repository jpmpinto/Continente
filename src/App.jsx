import React, { useState } from 'react';
import { supabase } from './supabaseClient';

export default function App() {
  const [message, setMessage] = useState('Hello world');

  return (
    <div style={{ padding: 20 }}>
      <h1>{message}</h1>
    </div>
  );
}
