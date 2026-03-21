/** @type {import('tailwindcss').Config} */
export default {
	content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
	darkMode: "class",
	theme: {
		extend: {
			colors: {
				// Morning Theme - Light Mode (REQ-TS-001)
				"morning-light": {
					page: "#f4f3ee",
					card: "#f5e6d3",
					hover: "#b1ada1",
					text: "#1a1915",
					muted: "#6b6860",
				},
				// Morning Theme - Dark Mode (REQ-TS-001)
				"morning-dark": {
					page: "#1a1915",
					card: "#252420",
					cardSecondary: "#2d2b27",
					hover: "#38352f",
					text: "#f4f3ee",
					muted: "#9a9590",
				},
			},
		},
	},
	plugins: [],
};
