import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        navy: {
          DEFAULT: '#0F172A',
          light: '#1E293B',
        },
        cyan: {
          DEFAULT: '#22D3EE',
          glow: 'rgba(34,211,238,0.15)',
          dark: '#0891B2',
        },
        lavender: {
          DEFAULT: '#A78BFA',
          glow: 'rgba(167,139,250,0.15)',
          dark: '#7C3AED',
        },
      },
      backdropBlur: {
        xs: '2px',
        glass: '24px',
        heavy: '48px',
      },
      borderRadius: {
        glass: '12px',
        'glass-lg': '20px',
        'glass-xl': '28px',
      },
      boxShadow: {
        'glow-cyan': '0 0 20px rgba(34,211,238,0.15), 0 0 60px rgba(34,211,238,0.08)',
        'glow-lavender': '0 0 20px rgba(167,139,250,0.15), 0 0 60px rgba(167,139,250,0.08)',
        'glow-cyan-lg': '0 0 40px rgba(34,211,238,0.25), 0 0 80px rgba(34,211,238,0.12)',
        'glow-lavender-lg': '0 0 40px rgba(167,139,250,0.25), 0 0 80px rgba(167,139,250,0.12)',
        glass: '0 8px 32px rgba(0,0,0,0.3)',
      },
      animation: {
        shimmer: 'shimmer 3s ease-in-out infinite',
        float: 'float 8s ease-in-out infinite',
        'float-slow': 'float 12s ease-in-out infinite',
        'pulse-glow': 'pulse-glow 2s ease-in-out infinite',
        'slide-up': 'slide-up 0.3s ease-out',
        'fade-in': 'fade-in 0.3s ease-out',
      },
      keyframes: {
        shimmer: {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(100%)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0px) scale(1)' },
          '50%': { transform: 'translateY(-20px) scale(1.05)' },
        },
        'pulse-glow': {
          '0%, 100%': { opacity: '0.6' },
          '50%': { opacity: '1' },
        },
        'slide-up': {
          '0%': { transform: 'translateY(10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
} satisfies Config;
