import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50:  '#fdf9ed',
          100: '#faefc9',
          200: '#f5dd8e',
          300: '#f0c54f',
          400: '#ebac28',
          500: '#d8900f',
          600: '#b8710a',
          700: '#8f540c',
          800: '#764411',
          900: '#643913',
          950: '#3a1e07',
        },
        green: {
          50:  '#effef7',
          100: '#d9fced',
          200: '#b2f5d9',
          300: '#74e9bc',
          400: '#2ed59a',
          500: '#0cbf82',
          600: '#029b6a',
          700: '#047b57',
          800: '#076147',
          900: '#08503c',
          950: '#022d22',
        },
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        heading: ['Poppins', 'sans-serif'],
      },
    },
  },
  plugins: [],
}

export default config
