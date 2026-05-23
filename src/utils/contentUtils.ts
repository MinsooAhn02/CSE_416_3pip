export const cleanContent = (text: unknown): string => {
	if (!text) return "";
	return String(text)
		.replace(/#{1,6}\s+[^\n#]*/g, "")
		.replace(/#\w[\w-]*/g, "")
		.replace(/\*\*([^*]+)\*\*/g, "$1")
		.replace(/\*([^*]+)\*/g, "$1")
		.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
		.replace(/follow us[^.!?]*/gi, "")
		.replace(/subscribe[^.!?]*/gi, "")
		.replace(/sign up[^.!?]*/gi, "")
		.replace(/newsletter[^.!?]*/gi, "")
		.replace(/click here[^.!?]*/gi, "")
		.replace(/^\s*[-•]\s*/gm, "")
		.replace(/\n+/g, " ")
		.replace(/\s{2,}/g, " ")
		.trim();
};
