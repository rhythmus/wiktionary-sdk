/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                'bg-color': '#0d0f14',
                'text-primary': '#f1f5f9',
                'text-secondary': '#94a3b8',
                'text-muted': '#64748b',
                'error': '#ef4444',
            }
        },
    },
    plugins: [],
}
