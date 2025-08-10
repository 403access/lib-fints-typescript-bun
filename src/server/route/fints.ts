// ---------------------------------------------------------------------------
// Example Next.js App Router backend (app/api/fints/route.ts)
// ---------------------------------------------------------------------------

/*
  Place this file at: /app/api/fints/route.ts (Next.js 13+ App Router)
  Install dependencies: `npm i lib-fints` (or `pnpm add lib-fints`)

  This handler keeps a session per client using a signed cookie. For a quick
  demo it stores the FinTS client & config in-memory. Replace with a proper
  store in production.
*/

// ----- BEGIN: /app/api/fints/route.ts -----

// import { NextRequest, NextResponse } from "next/server";
// import { cookies } from "next/headers";
// import { FinTSClient, FinTSConfig } from "lib-fints";
// import { randomUUID } from "crypto";

// type Session = {
//   client: any; // FinTSClient
//   config: any; // FinTSConfig
//   pending?: { op: "sync" | "balance" | "statements"; accountNumber?: string };
// };
// const sessions = new Map<string, Session>();

// function getOrCreateSession(req: NextRequest): { id: string; session: Session } {
//   const jar = cookies();
//   let sid = jar.get("fints_sid")?.value;
//   if (!sid || !sessions.has(sid)) {
//     sid = randomUUID();
//     jar.set("fints_sid", sid, { httpOnly: true, sameSite: "lax", secure: true, path: "/" });
//     sessions.set(sid, { client: null, config: null });
//   }
//   const session = sessions.get(sid)!;
//   return { id: sid, session };
// }

// export async function POST(req: NextRequest) {
//   try {
//     const { id, session } = getOrCreateSession(req);
//     const { action, payload } = await req.json();

//     if (action === "startSession") {
//       const { productId, productVersion, bankUrl, bankId, userId, pin } = payload;
//       const config = FinTSConfig.forFirstTimeUse(productId, productVersion, bankUrl, bankId, userId, pin);
//       const client = new FinTSClient(config);
//       session.client = client;
//       session.config = config;
//       return NextResponse.json({ bankingInformation: null });
//     }

//     if (!session.client) return NextResponse.json({ error: "No active session" }, { status: 400 });

//     if (action === "selectTan") {
//       const { tanMethodId, tanMediaName } = payload || {};
//       if (tanMethodId) session.client.selectTanMethod(Number(tanMethodId));
//       if (tanMediaName) session.client.selectTanMedia(tanMediaName);
//       return NextResponse.json({ bankingInformation: session.config.bankingInformation });
//     }

//     if (action === "synchronize") {
//       const res = await session.client.synchronize();
//       if (res.requiresTan) {
//         session.pending = { op: "sync" };
//         return NextResponse.json(res);
//       }
//       return NextResponse.json({ ...res, data: { bankingInformation: session.config.bankingInformation } });
//     }

//     if (action === "getAccountBalance") {
//       const { accountNumber } = payload || {};
//       const res = await session.client.getAccountBalance(accountNumber);
//       if (res.requiresTan) {
//         session.pending = { op: "balance", accountNumber };
//         return NextResponse.json(res);
//       }
//       return NextResponse.json(res);
//     }

//     if (action === "getAccountStatements") {
//       const { accountNumber } = payload || {};
//       const res = await session.client.getAccountStatements(accountNumber);
//       if (res.requiresTan) {
//         session.pending = { op: "statements", accountNumber };
//         return NextResponse.json(res);
//       }
//       return NextResponse.json(res);
//     }

//     if (action === "submitTan") {
//       const { tan, tanReference, op } = payload || {};
//       if (!session.pending || session.pending.op !== op) {
//         return NextResponse.json({ error: "No pending TAN op" }, { status: 400 });
//       }
//       let res;
//       if (op === "sync") res = await session.client.synchronizeWithTan(tanReference, tan);
//       if (op === "balance") res = await session.client.getAccountBalanceWithTan(session.pending.accountNumber, tanReference, tan);
//       if (op === "statements") res = await session.client.getAccountStatementsWithTan(session.pending.accountNumber, tanReference, tan);
//       session.pending = undefined;
//       return NextResponse.json(res);
//     }

//     return NextResponse.json({ error: "Unknown action" }, { status: 400 });
//   } catch (err: any) {
//     return NextResponse.json({ error: err?.message || String(err) }, { status: 500 });
//   }
// }

// ----- END: /app/api/fints/route.ts -----

// Tailwind: ensure your project has Tailwind configured, e.g., with `@tailwind base; @tailwind components; @tailwind utilities;` in your globals.
