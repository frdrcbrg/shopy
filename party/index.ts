import type * as Party from 'partykit/server';
import type { Item, Msg } from '../src/lib/types';

export default {
	async onConnect(conn: Party.Connection, room: Party.Room) {
		const stored = await room.storage.get<Item[]>('items');
		const items: Item[] = stored ?? [];
		const msg: Msg = { type: 'sync', items };
		conn.send(JSON.stringify(msg));
	},

	async onMessage(message: string, sender: Party.Connection, room: Party.Room) {
		let parsed: Msg;
		try {
			parsed = JSON.parse(message) as Msg;
		} catch {
			return;
		}

		const stored = await room.storage.get<Item[]>('items');
		let items: Item[] = stored ?? [];

		if (parsed.type === 'add') {
			const exists = items.findIndex((i) => i.id === parsed.item.id);
			if (exists === -1) {
				items = [...items, parsed.item];
			}
		} else if (parsed.type === 'remove') {
			items = items.filter((i) => i.id !== parsed.id);
		} else if (parsed.type === 'toggle') {
			items = items.map((i) =>
				i.id === parsed.id
					? { ...i, done: parsed.done, updatedAt: parsed.updatedAt }
					: i
			);
		} else if (parsed.type === 'sync') {
			// Client-initiated full sync (room restore from localStorage backup)
			items = parsed.items;
		}

		await room.storage.put('items', items);

		// Broadcast to all connections except sender
		room.broadcast(JSON.stringify(parsed), [sender.id]);
	}
} satisfies Party.Server;
