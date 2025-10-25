module.exports = {
	content: [
		'./views/**/*.ejs',
		'./src/**/*.ts',
		'./public/**/*.html'
	],
	safelist: [
		'modern-blue-50', 'modern-blue-100', 'modern-blue-200', 'modern-blue-300', 'modern-blue-400', 'modern-blue-500', 'modern-blue-600', 'modern-blue-700', 'modern-blue-800', 'modern-blue-900',
		'modern-purple-50', 'modern-purple-100', 'modern-purple-200', 'modern-purple-300', 'modern-purple-400', 'modern-purple-500', 'modern-purple-600', 'modern-purple-700', 'modern-purple-800', 'modern-purple-900',
		'modern-pink-50', 'modern-pink-100', 'modern-pink-200', 'modern-pink-300', 'modern-pink-400', 'modern-pink-500', 'modern-pink-600', 'modern-pink-700', 'modern-pink-800', 'modern-pink-900',
		'modern-orange-50', 'modern-orange-100', 'modern-orange-200', 'modern-orange-300', 'modern-orange-400', 'modern-orange-500', 'modern-orange-600', 'modern-orange-700', 'modern-orange-800', 'modern-orange-900',
		'modern-green-50', 'modern-green-100', 'modern-green-200', 'modern-green-300', 'modern-green-400', 'modern-green-500', 'modern-green-600', 'modern-green-700', 'modern-green-800', 'modern-green-900',
		'modern-cyan-50', 'modern-cyan-100', 'modern-cyan-200', 'modern-cyan-300', 'modern-cyan-400', 'modern-cyan-500', 'modern-cyan-600', 'modern-cyan-700', 'modern-cyan-800', 'modern-cyan-900',
		'modern-indigo-50', 'modern-indigo-100', 'modern-indigo-200', 'modern-indigo-300', 'modern-indigo-400', 'modern-indigo-500', 'modern-indigo-600', 'modern-indigo-700', 'modern-indigo-800', 'modern-indigo-900',
		'modern-emerald-50', 'modern-emerald-100', 'modern-emerald-200', 'modern-emerald-300', 'modern-emerald-400', 'modern-emerald-500', 'modern-emerald-600', 'modern-emerald-700', 'modern-emerald-800', 'modern-emerald-900',
		'modern-rose-50', 'modern-rose-100', 'modern-rose-200', 'modern-rose-300', 'modern-rose-400', 'modern-rose-500', 'modern-rose-600', 'modern-rose-700', 'modern-rose-800', 'modern-rose-900',
		'modern-amber-50', 'modern-amber-100', 'modern-amber-200', 'modern-amber-300', 'modern-amber-400', 'modern-amber-500', 'modern-amber-600', 'modern-amber-700', 'modern-amber-800', 'modern-amber-900'
	],
	theme: {
		extend: {
			colors: {
				primary: {
					50: '#eef6ff',
					100: '#dbeafe',
					200: '#bfdbfe',
					300: '#93c5fd',
					400: '#60a5fa',
					500: '#3b82f6',
					600: '#2563eb',
					700: '#1d4ed8',
					800: '#1e40af',
					900: '#1e3a8a'
				},
				'modern-blue': {
					50: '#eff6ff',
					100: '#dbeafe',
					200: '#bfdbfe',
					300: '#93c5fd',
					400: '#60a5fa',
					500: '#3b82f6',
					600: '#2563eb',
					700: '#1d4ed8',
					800: '#1e40af',
					900: '#1e3a8a'
				},
				'modern-purple': {
					50: '#faf5ff',
					100: '#f3e8ff',
					200: '#e9d5ff',
					300: '#d8b4fe',
					400: '#c084fc',
					500: '#a855f7',
					600: '#9333ea',
					700: '#7c3aed',
					800: '#6b21a8',
					900: '#581c87'
				},
				'modern-pink': {
					50: '#fdf2f8',
					100: '#fce7f3',
					200: '#fbcfe8',
					300: '#f9a8d4',
					400: '#f472b6',
					500: '#ec4899',
					600: '#db2777',
					700: '#be185d',
					800: '#9d174d',
					900: '#831843'
				},
				'modern-orange': {
					50: '#fff7ed',
					100: '#ffedd5',
					200: '#fed7aa',
					300: '#fdba74',
					400: '#fb923c',
					500: '#f97316',
					600: '#ea580c',
					700: '#c2410c',
					800: '#9a3412',
					900: '#7c2d12'
				},
				'modern-green': {
					50: '#f0fdf4',
					100: '#dcfce7',
					200: '#bbf7d0',
					300: '#86efac',
					400: '#4ade80',
					500: '#22c55e',
					600: '#16a34a',
					700: '#15803d',
					800: '#166534',
					900: '#14532d'
				},
				'modern-cyan': {
					50: '#ecfeff',
					100: '#cffafe',
					200: '#a5f3fc',
					300: '#67e8f9',
					400: '#22d3ee',
					500: '#06b6d4',
					600: '#0891b2',
					700: '#0e7490',
					800: '#155e75',
					900: '#164e63'
				},
				'modern-indigo': {
					50: '#eef2ff',
					100: '#e0e7ff',
					200: '#c7d2fe',
					300: '#a5b4fc',
					400: '#818cf8',
					500: '#6366f1',
					600: '#4f46e5',
					700: '#4338ca',
					800: '#3730a3',
					900: '#312e81'
				},
				'modern-emerald': {
					50: '#ecfdf5',
					100: '#d1fae5',
					200: '#a7f3d0',
					300: '#6ee7b7',
					400: '#34d399',
					500: '#10b981',
					600: '#059669',
					700: '#047857',
					800: '#065f46',
					900: '#064e3b'
				},
				'modern-rose': {
					50: '#fff1f2',
					100: '#ffe4e6',
					200: '#fecdd3',
					300: '#fda4af',
					400: '#fb7185',
					500: '#f43f5e',
					600: '#e11d48',
					700: '#be123c',
					800: '#9f1239',
					900: '#881337'
				},
				'modern-amber': {
					50: '#fffbeb',
					100: '#fef3c7',
					200: '#fde68a',
					300: '#fcd34d',
					400: '#fbbf24',
					500: '#f59e0b',
					600: '#d97706',
					700: '#b45309',
					800: '#92400e',
					900: '#78350f'
				}
			}
		}
	},
	plugins: []
};


