import type { Config } from 'tailwindcss'

export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        'diff-add': '#d4edda',
        'diff-add-border': '#c3e6cb',
        'diff-add-text': '#155724',
        'diff-remove': '#f8d7da',
        'diff-remove-border': '#f5c6cb',
        'diff-remove-text': '#721c24',
        'diff-neutral': '#f8f9fa',
        'diff-neutral-border': '#dee2e6',
      },
      fontFamily: {
        mono: ['"Fira Code"', '"Courier New"', 'monospace'],
      },
    },
  },
} satisfies Config
