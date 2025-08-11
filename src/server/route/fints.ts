/*
  FinTS API handler for Bun server
  
  This handler keeps a session per client using a signed cookie. For a quick
  demo it stores the FinTS client & config in-memory. Replace with a proper
  store in production.
*/

import { randomUUID } from "node:crypto";
import { FinTSClient, FinTSConfig } from "lib-fints";

type Session = {
	client: FinTSClient | null;
	config: FinTSConfig | null;
	pending?: { op: "sync" | "balance" | "statements"; accountNumber?: string };
};

const sessions = new Map<string, Session>();

function getOrCreateSession(req: Request): {
	id: string;
	session: Session;
	setCookie?: string;
} {
	const cookieHeader = req.headers.get("Cookie");
	const cookies = cookieHeader
		? Object.fromEntries(
				cookieHeader
					.split("; ")
					.map((c) => c.split("=").map(decodeURIComponent)),
			)
		: {};

	let sid = cookies.fints_sid;
	let setCookie: string | undefined;

	if (!sid || !sessions.has(sid)) {
		sid = randomUUID();
		setCookie = `fints_sid=${encodeURIComponent(sid)}; HttpOnly; SameSite=Lax; Secure; Path=/`;
		sessions.set(sid, { client: null, config: null });
	}

	const session = sessions.get(sid);
	if (!session) {
		throw new Error("Session not found");
	}
	return { id: sid, session, setCookie };
}

export async function handleFinTSRequest(req: Request): Promise<Response> {
	try {
		const { session, setCookie } = getOrCreateSession(req);
		const { action, payload } = await req.json();

		const headers: HeadersInit = {
			"Content-Type": "application/json",
		};

		if (setCookie) {
			headers["Set-Cookie"] = setCookie;
		}

		if (action === "startSession") {
			const { productId, productVersion, bankUrl, bankId, userId, pin } =
				payload;

			const config = FinTSConfig.forFirstTimeUse(
				productId,
				productVersion,
				bankUrl,
				bankId,
				userId,
				pin,
			);

			const client = new FinTSClient(config);
			session.client = client;
			session.config = config;

			// Perform initial synchronization to get banking information
			try {
				const syncRes = await client.synchronize();
				if (syncRes.requiresTan) {
					// If TAN is required for initial sync, store the pending operation
					session.pending = { op: "sync" };
					return new Response(
						JSON.stringify({
							bankingInformation: config.bankingInformation || null,
							requiresTan: true,
							tanChallenge: syncRes.tanChallenge,
							tanReference: syncRes.tanReference,
							bankAnswers: syncRes.bankAnswers,
						}),
						{ headers },
					);
				}
				// Sync completed, return the banking information
				return new Response(
					JSON.stringify({
						bankingInformation: config.bankingInformation || null,
					}),
					{ headers },
				);
			} catch (error) {
				// If sync fails, still return the session but with null banking info
				console.warn("Initial sync failed:", error);
				return new Response(
					JSON.stringify({
						bankingInformation: null,
						error: error instanceof Error ? error.message : String(error),
					}),
					{ headers },
				);
			}
		}

		if (!session.client && action !== "startSession") {
			return new Response(JSON.stringify({ error: "No active session" }), {
				status: 400,
				headers,
			});
		}

		if (action === "selectTan") {
			if (!session.client) {
				return new Response(JSON.stringify({ error: "No active session" }), {
					status: 400,
					headers,
				});
			}

			const { tanMethodId, tanMediaName } = payload || {};
			if (tanMethodId) session.client.selectTanMethod(Number(tanMethodId));
			if (tanMediaName) session.client.selectTanMedia(tanMediaName);

			const bankingInformation = session.config?.bankingInformation || null;
			return new Response(JSON.stringify({ bankingInformation }), { headers });
		}

		if (action === "synchronize") {
			if (!session.client) {
				return new Response(JSON.stringify({ error: "No active session" }), {
					status: 400,
					headers,
				});
			}

			const res = await session.client.synchronize();
			if (res.requiresTan) {
				session.pending = { op: "sync" };
				return new Response(JSON.stringify(res), { headers });
			}

			const bankingInformation = session.config?.bankingInformation;
			if (!bankingInformation) {
				throw new Error("Banking information not available");
			}

			const response = {
				...res,
				data: { bankingInformation },
			};

			return new Response(JSON.stringify(response), { headers });
		}

		if (action === "getAccountBalance") {
			if (!session.client) {
				return new Response(JSON.stringify({ error: "No active session" }), {
					status: 400,
					headers,
				});
			}

			const { accountNumber } = payload || {};
			const res = await session.client.getAccountBalance(accountNumber);
			if (res.requiresTan) {
				session.pending = { op: "balance", accountNumber };
				return new Response(JSON.stringify(res), { headers });
			}

			return new Response(JSON.stringify(res), { headers });
		}

		if (action === "getAccountStatements") {
			if (!session.client) {
				return new Response(JSON.stringify({ error: "No active session" }), {
					status: 400,
					headers,
				});
			}

			const { accountNumber } = payload || {};
			const res = await session.client.getAccountStatements(accountNumber);
			if (res.requiresTan) {
				session.pending = { op: "statements", accountNumber };
				return new Response(JSON.stringify(res), { headers });
			}

			return new Response(JSON.stringify(res), { headers });
		}

		if (action === "submitTan") {
			if (!session.client) {
				return new Response(JSON.stringify({ error: "No active session" }), {
					status: 400,
					headers,
				});
			}

			const { tan, tanReference, op } = payload || {};
			if (!session.pending || session.pending.op !== op) {
				return new Response(JSON.stringify({ error: "No pending TAN op" }), {
					status: 400,
					headers,
				});
			}

			let res: unknown;

			try {
				if (op === "sync") {
					// For decoupled TAN methods, tan can be undefined/empty
					res = await session.client.synchronizeWithTan(
						tanReference,
						tan || undefined,
					);
					// Add banking information to sync response
					if (
						res &&
						typeof res === "object" &&
						"success" in res &&
						res.success
					) {
						const bankingInformation = session.config?.bankingInformation;
						if (bankingInformation) {
							(res as Record<string, unknown>).data = { bankingInformation };
						}
					}
				} else if (op === "balance") {
					const accountNumber = session.pending.accountNumber;
					if (!accountNumber) {
						return new Response(
							JSON.stringify({
								error: "No account number for balance operation",
							}),
							{ status: 400, headers },
						);
					}
					res = await session.client.getAccountBalanceWithTan(
						tanReference,
						tan || undefined,
					);
				} else if (op === "statements") {
					const accountNumber = session.pending.accountNumber;
					if (!accountNumber) {
						return new Response(
							JSON.stringify({
								error: "No account number for statements operation",
							}),
							{ status: 400, headers },
						);
					}
					res = await session.client.getAccountStatementsWithTan(
						tanReference,
						tan || undefined,
					);
				} else {
					return new Response(JSON.stringify({ error: "Invalid operation" }), {
						status: 400,
						headers,
					});
				}

				session.pending = undefined;
				return new Response(JSON.stringify(res), { headers });
			} catch (error) {
				// Handle cases where the TAN approval is still pending
				const errorMessage =
					error instanceof Error ? error.message : String(error);

				// Common error messages that indicate the user needs more time to approve
				if (
					errorMessage.includes("noch nicht freigegeben") ||
					errorMessage.includes("Auftrag wurde noch nicht") ||
					errorMessage.includes("not yet approved") ||
					errorMessage.includes("pending approval")
				) {
					return new Response(
						JSON.stringify({
							error:
								"TAN approval still pending. Please complete the approval in your banking app and try again.",
							isPending: true,
							tanReference: tanReference, // Keep the same reference for retry
						}),
						{ status: 202, headers }, // 202 = Accepted but processing not complete
					);
				}

				// For other errors, clear the pending operation and return error
				session.pending = undefined;
				return new Response(JSON.stringify({ error: errorMessage }), {
					status: 400,
					headers,
				});
			}
		}

		return new Response(JSON.stringify({ error: "Unknown action" }), {
			status: 400,
			headers,
		});
	} catch (err: unknown) {
		const errorMessage = err instanceof Error ? err.message : String(err);
		return new Response(JSON.stringify({ error: errorMessage }), {
			status: 500,
			headers: { "Content-Type": "application/json" },
		});
	}
}
