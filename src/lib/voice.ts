// Conjunctions to split on, per language family.
// Covers EN, DE, FR, ES, IT, PT, NL, PL, SV, DA, NO, FI
const CONJUNCTIONS =
	/\s+(?:and|und|et|y|e|en|och|og|og|ja|i)\s+|\s*,\s*/i;

// Leading command verbs to strip, per language family.
const LEADING_VERBS =
	/^(?:add|get|buy|put|also|hinzufügen|kaufen|hol|besorge?|ajoute?r?|achète?r?|prends?|agrega?r?|compra?r?|toma?r?|aggiungi?|compra?r?|prendi?|adiciona?r?|compra?r?|pega?r?|toevoegen|koop|haal|dodaj|kup|weź|lägg till|köp|hämta|tilføj|køb|hent|lisää|osta|hae)\s+/i;

export function normalizeVoice(transcript: string): string[] {
	return transcript
		.split(CONJUNCTIONS)
		.map((part) => part.replace(LEADING_VERBS, '').trim())
		.map((part) => part.replace(/^./u, (c) => c.toUpperCase()))
		.filter((part) => part.length > 0);
}
