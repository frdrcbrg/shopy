export interface Item {
	id: string;
	text: string;
	done: boolean;
	updatedAt: number;
	v: 1;
}

export type Msg =
	| { type: 'add'; item: Item }
	| { type: 'remove'; id: string }
	| { type: 'toggle'; id: string; done: boolean; updatedAt: number }
	| { type: 'sync'; items: Item[] };

export function parseMsg(data: unknown): Msg | null {
	if (typeof data !== 'string') return null;
	try {
		const obj = JSON.parse(data) as Record<string, unknown>;
		if (obj.type === 'add' && obj.item) return obj as Msg;
		if (obj.type === 'remove' && typeof obj.id === 'string') return obj as Msg;
		if (obj.type === 'toggle' && typeof obj.id === 'string') return obj as Msg;
		if (obj.type === 'sync' && Array.isArray(obj.items)) return obj as Msg;
		return null;
	} catch {
		return null;
	}
}
