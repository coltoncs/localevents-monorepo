import { useSyncExternalStore } from "react";

// Minimal app-wide toast store. Call toast() from anywhere (including async
// handlers whose component may have unmounted by the time they finish);
// <Toaster /> in the root layout renders whatever is queued.

export interface Toast {
	id: number;
	message: string;
}

const EMPTY: Toast[] = [];
let toasts: Toast[] = EMPTY;
let nextId = 1;
const listeners = new Set<() => void>();

function emit() {
	for (const l of listeners) l();
}

export function dismissToast(id: number) {
	toasts = toasts.filter((t) => t.id !== id);
	emit();
}

export function toast(message: string, { duration = 5000 } = {}) {
	const id = nextId++;
	toasts = [...toasts, { id, message }];
	emit();
	setTimeout(() => dismissToast(id), duration);
}

function subscribe(listener: () => void) {
	listeners.add(listener);
	return () => listeners.delete(listener);
}

export function useToasts(): Toast[] {
	return useSyncExternalStore(
		subscribe,
		() => toasts,
		() => EMPTY,
	);
}
