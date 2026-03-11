import { useTheme } from "../../hooks/useTheme";

const Toggle = ({ on, onToggle }) => {
	const { isDark } = useTheme();

	return (
		<button
			type="button"
			onClick={onToggle}
			className={`w-11 h-6 rounded-full relative transition-colors ${on ? "bg-blue-500" : isDark ? "bg-white/20" : "bg-gray-300"}`}
		>
			<div
				className={`w-5 h-5 bg-white rounded-full absolute top-0.5 transition-transform shadow ${on ? "translate-x-5" : "translate-x-0.5"}`}
			/>
		</button>
	);
};

export default Toggle;
