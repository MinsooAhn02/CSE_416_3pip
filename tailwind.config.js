/** @type {import('tailwindcss').Config} */
export default {
	content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
	darkMode: "class",
	theme: {
		extend: {
			colors: {
				// Global palette theme (eye-comfort, clearly separated light/dark)
				"morning-light": {
					page: "#F7F3E9",
					card: "#FFFDF8",
					cardSecondary: "#F1EBDD",
					hover: "#E6DECD",
					accent: "#5D7FCB",
					text: "#2F2A22",
					muted: "rgba(47, 42, 34, 0.62)",
				},
				// Dark mode tuned for readability without harsh contrast
				"morning-dark": {
					page: "#1A1B1E",
					card: "#25272C",
					cardSecondary: "#2F3238",
					hover: "#3A3D45",
					accent: "#84A0CF",
					text: "#ECE8DF",
					muted: "rgba(236, 232, 223, 0.66)",
				},
			},
		},
	},
	plugins: [],
};
