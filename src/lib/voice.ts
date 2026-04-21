const LEADING_VERBS = /^(add|also|get|buy|put)\s+/i;

export function normalizeVoice(transcript: string): string[] {
	return transcript
		.split(/\s+and\s+|\s*,\s*/i)
		.map((part) => part.replace(LEADING_VERBS, '').trim())
		.map((part) => part.replace(/^./, (c) => c.toUpperCase()))
		.filter((part) => part.length > 0);
}
