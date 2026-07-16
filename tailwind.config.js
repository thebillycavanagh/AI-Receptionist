/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // "Switchboard" palette — deep ink on warm paper, one signal accent.
        paper: '#F6F4EF',
        ink: {
          DEFAULT: '#1B2430',
          soft: '#3C4656',
          faint: '#7C8598',
        },
        line: '#E1DCD1',
        signal: {
          DEFAULT: '#C4581F', // amber-ember accent, used sparingly for urgency
          soft: '#F1E3D3',
        },
        ok: {
          DEFAULT: '#2E5945',
          soft: '#E3EDE6',
        },
        warn: {
          DEFAULT: '#8A4B12',
          soft: '#F4E7D3',
        },
        mute: {
          DEFAULT: '#6B7280',
          soft: '#EDEDEA',
        },
      },
      fontFamily: {
        display: ['"Source Serif 4"', 'Georgia', 'serif'],
        sans: ['"IBM Plex Sans"', 'system-ui', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'ui-monospace', 'monospace'],
      },
      borderRadius: {
        sm: '2px',
        DEFAULT: '3px',
        md: '4px',
      },
    },
  },
  plugins: [],
}
