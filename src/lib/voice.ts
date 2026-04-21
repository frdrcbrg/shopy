const PREFIXES = /^(add|and|also|get|buy|put)\s+/i;

export function normalizeVoice(transcript: string): string {
	return transcript.replace(PREFIXES, '').trim().replace(/^./, (c) => c.toUpperCase());
}
