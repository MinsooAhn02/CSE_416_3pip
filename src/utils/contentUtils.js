/**
 * Strips markdown artifacts and social-media/newsletter junk from Tavily content.
 */
export const cleanContent = (text) => {
	if (!text) return "";
	return text
		.replace(/#{1,6}\s+[^\n#]*/g, "")        // markdown headings (anywhere in string)
		.replace(/#\w[\w-]*/g, "")               // #hashtag words
		.replace(/\*\*([^*]+)\*\*/g, "$1")       // **bold**
		.replace(/\*([^*]+)\*/g, "$1")           // *italic*
		.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1") // [link](url) → text
		.replace(/follow us[^.!?]*/gi, "")        // "follow us on..."
		.replace(/subscribe[^.!?]*/gi, "")        // "subscribe to..."
		.replace(/sign up[^.!?]*/gi, "")          // "sign up for..."
		.replace(/newsletter[^.!?]*/gi, "")       // "newsletter..."
		.replace(/click here[^.!?]*/gi, "")       // "click here..."
		.replace(/^\s*[-•]\s*/gm, "")             // list bullets at line start
		.replace(/\n+/g, " ")                     // newlines → space
		.replace(/\s{2,}/g, " ")                  // multiple spaces
		.trim();
};
