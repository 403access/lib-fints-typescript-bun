import { randomUUID } from "node:crypto";
import type { Session, SessionManager } from "./types";

const sessions = new Map<string, Session>();

export function getOrCreateSession(req: Request): SessionManager {
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

export function clearSession(sessionId: string): void {
	sessions.delete(sessionId);
}

export function getAllSessions(): Map<string, Session> {
	return sessions;
}
