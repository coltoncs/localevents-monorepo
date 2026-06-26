import {
	createStartHandler,
	defaultStreamHandler,
} from "@tanstack/react-start/server";
import { routeAgentRequest } from "agents";

// The agent Durable Object must be a named export of the worker's main module
// so Cloudflare can register it (the rollup server build uses this file as its
// entry, so this re-export is preserved in the worker bundle).
export { EventChatAgent } from "./agent/EventChatAgent";

// Mirror of @tanstack/react-start's default server entry. At runtime Cloudflare
// invokes `fetch(request, env, ctx)`; createStartHandler reads bindings from the
// `cloudflare:workers` env internally, so we forward all args through unchanged.
const tanstackFetch = createStartHandler(defaultStreamHandler);

// PartyServer derives a Durable Object's instance name from `ctx.id.name`,
// which some runtimes (notably the local vite-dev DO emulation) don't populate
// for idFromName-addressed stubs. Forwarding the parsed room name as the
// officially-supported `x-partykit-room` header makes name resolution robust;
// in production (where ctx.id.name is set) the header is ignored.
function withRoomName(req: Request, lobby: { name: string }): Request {
	req.headers.set("x-partykit-room", lobby.name);
	return req;
}

export default {
	async fetch(request: Request, ...rest: unknown[]): Promise<Response> {
		// Agent routes (/agents/*) include the WebSocket upgrade that powers the
		// chat. They must be handled before TanStack's SSR handler sees them.
		const env = rest[0] as Cloudflare.Env;
		const agentResponse = await routeAgentRequest(request, env, {
			onBeforeConnect: withRoomName,
			onBeforeRequest: withRoomName,
		});
		if (agentResponse) return agentResponse;

		return (tanstackFetch as (...args: unknown[]) => Promise<Response>)(
			request,
			...rest,
		);
	},
};
