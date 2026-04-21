import PartySocket from 'partysocket';
import { customAlphabet } from 'nanoid';
import { parseMsg, type Item, type Msg } from './types';

const roomId6 = customAlphabet('ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789', 6);
const itemId = customAlphabet('abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789', 10);

const STORAGE_KEY = 'shopy_items';
const ROOM_KEY = 'shopy_room';
const PARTYKIT_HOST = import.meta.env.VITE_PARTYKIT_HOST ?? 'shopy.frdrcbrg.partykit.dev';

function loadItems(): Item[] {
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		return raw ? (JSON.parse(raw) as Item[]) : [];
	} catch {
		return [];
	}
}

function loadRoom(): string {
	const stored = localStorage.getItem(ROOM_KEY);
	if (stored) return stored;
	const id = roomId6();
	localStorage.setItem(ROOM_KEY, id);
	return id;
}

let persistTimer: ReturnType<typeof setTimeout> | null = null;

function schedulePersist(items: Item[]) {
	if (persistTimer) clearTimeout(persistTimer);
	persistTimer = setTimeout(() => {
		try {
			localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
		} catch {
			// localStorage full — ignore
		}
	}, 100);
}

// Svelte 5 runes-based store
class ShopyStore {
	items = $state<Item[]>([]);
	roomId = $state<string>('');
	connected = $state(false);
	offline = $state(false);

	private socket: PartySocket | null = null;
	private offlineQueue: Msg[] = [];
	private restoring = false;

	init() {
		this.roomId = loadRoom();
		this.items = loadItems();
		this.connect();

		if (typeof document !== 'undefined') {
			document.addEventListener('visibilitychange', () => {
				if (document.visibilityState === 'visible') {
					if (!this.socket || this.socket.readyState === WebSocket.CLOSED) {
						this.connect();
					}
				}
			});
		}
	}

	joinRoom(code: string) {
		const normalized = code.trim().toUpperCase();
		if (normalized.length !== 6) return false;
		localStorage.setItem(ROOM_KEY, normalized);
		this.roomId = normalized;
		// Clear local items — will receive sync from server
		this.items = [];
		this.socket?.close();
		this.connect();
		return true;
	}

	newRoom() {
		const id = roomId6();
		localStorage.setItem(ROOM_KEY, id);
		localStorage.removeItem(STORAGE_KEY);
		this.roomId = id;
		this.items = [];
		this.socket?.close();
		this.connect();
	}

	addItem(text: string) {
		const item: Item = {
			id: itemId(),
			text,
			done: false,
			updatedAt: Date.now(),
			v: 1
		};
		this.items = [...this.items, item];
		schedulePersist(this.items);
		this.send({ type: 'add', item });
	}

	toggleItem(id: string) {
		const item = this.items.find((i) => i.id === id);
		if (!item) return;
		const updatedAt = Date.now();
		const done = !item.done;
		this.items = this.items.map((i) => (i.id === id ? { ...i, done, updatedAt } : i));
		schedulePersist(this.items);
		this.send({ type: 'toggle', id, done, updatedAt });
	}

	removeItem(id: string) {
		this.items = this.items.filter((i) => i.id !== id);
		schedulePersist(this.items);
		this.send({ type: 'remove', id });
	}

	private send(msg: Msg) {
		if (this.socket?.readyState === WebSocket.OPEN) {
			this.socket.send(JSON.stringify(msg));
		} else {
			this.offlineQueue.push(msg);
		}
	}

	private connect() {
		const socket = new PartySocket({
			host: PARTYKIT_HOST,
			room: this.roomId,
			party: 'main'
		});

		socket.addEventListener('open', () => {
			this.connected = true;
			this.offline = false;
			this.flushQueue();
		});

		socket.addEventListener('close', () => {
			this.connected = false;
		});

		socket.addEventListener('error', () => {
			this.offline = true;
		});

		socket.addEventListener('message', (event: MessageEvent) => {
			const msg = parseMsg(event.data);
			if (!msg) return;

			if (msg.type === 'sync') {
				if (msg.items.length === 0 && this.items.length > 0 && !this.restoring) {
					// Server has empty room (expired) — restore from our local backup
					this.restoring = true;
					const restore: Msg = { type: 'sync', items: this.items };
					socket.send(JSON.stringify(restore));
					this.restoring = false;
				} else {
					this.items = msg.items;
					schedulePersist(this.items);
				}
			} else if (msg.type === 'add') {
				if (!this.items.find((i) => i.id === msg.item.id)) {
					this.items = [...this.items, msg.item];
					schedulePersist(this.items);
				}
			} else if (msg.type === 'remove') {
				this.items = this.items.filter((i) => i.id !== msg.id);
				schedulePersist(this.items);
			} else if (msg.type === 'toggle') {
				this.items = this.items.map((i) =>
					i.id === msg.id ? { ...i, done: msg.done, updatedAt: msg.updatedAt } : i
				);
				schedulePersist(this.items);
			}
		});

		this.socket = socket;
	}

	private flushQueue() {
		while (this.offlineQueue.length > 0) {
			const msg = this.offlineQueue.shift()!;
			this.socket?.send(JSON.stringify(msg));
		}
	}
}

export const store = new ShopyStore();
