import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      // Se houver necessidade, pode adicionar external aqui, mas normalmente não para supabase-js
      // external: ['@supabase/supabase-js'],
    }
  }
});
