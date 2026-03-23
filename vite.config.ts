import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  base: './', // ليعمل في أي مجلد فرعي مثل vi2
  plugins: [react(), tailwindcss()],
});