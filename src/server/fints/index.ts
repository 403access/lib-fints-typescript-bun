/*
  FinTS API handler for Bun server
  
  This handler keeps a session per client using a signed cookie. For a quick
  demo it stores the FinTS client & config in-memory. Replace with a proper
  store in production.
*/

import { getOrCreateSession } from "./session.js";
import type { FinTSRequest } from "./types";
import {
	handleStartSession,
	handleSelectTan,
	handleSynchronize,
	handleGetAccountBalance,
	handleGetAccountStatements,
	handleGetAllBalances,
	handleGetAllStatements,
	handleSubmitTan,
} from "./handlers/index.js";

export async function handleFinTSRequest(req: Request): Promise<Response> {
	try {
		const { session, setCookie } = getOrCreateSession(req);
		const { action, payload }: FinTSRequest = await req.json();

		const headers: HeadersInit = {
			"Content-Type": "application/json",
		};

		if (setCookie) {
			headers["Set-Cookie"] = setCookie;
		}

		// Handle start session action
		if (action === "startSession") {
			return await handleStartSession(session, payload || {}, headers);
		}

		// Check if session is active for all other actions
		if (!session.client) {
			return new Response(JSON.stringify({ error: "No active session" }), {
				status: 400,
				headers,
			});
		}

		// Route to appropriate handler
		switch (action) {
			case "selectTan":
				return await handleSelectTan(session, payload || {}, headers);

			case "synchronize":
				return await handleSynchronize(session, headers);

			case "getAccountBalance":
				return await handleGetAccountBalance(session, payload || {}, headers);

			case "getAccountStatements":
				return await handleGetAccountStatements(
					session,
					payload || {},
					headers,
				);

			case "getAllBalances":
				return await handleGetAllBalances(session, headers);

			case "getAllStatements":
				return await handleGetAllStatements(session, headers);

			case "submitTan":
				return await handleSubmitTan(session, payload || {}, headers);

			default:
				return new Response(JSON.stringify({ error: "Unknown action" }), {
					status: 400,
					headers,
				});
		}
	} catch (err: unknown) {
		const errorMessage = err instanceof Error ? err.message : String(err);
		return new Response(JSON.stringify({ error: errorMessage }), {
			status: 500,
			headers: { "Content-Type": "application/json" },
		});
	}
}
