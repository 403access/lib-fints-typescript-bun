import { serve } from "bun";
import homepage from "../client/App.html";
import { handleFinTSRequest } from "./routes/fints";

if (process.env.FINTS_PRODUCT_REGISTER_ID === undefined) {
	console.error(
		"Please set the FINTS_PRODUCT_REGISTER_ID environment variable to your registered product ID from DK/FinTS.",
	);
	process.exit(1);
}

console.log("Starting server...");

const server = serve({
	routes: {
		// ** HTML imports **
		// Bundle & route App.html to "/". This uses HTMLRewriter to scan the HTML for `<script>` and `<link>` tags, run's Bun's JavaScript & CSS bundler on them, transpiles any TypeScript, JSX, and TSX, downlevels CSS with Bun's CSS parser and serves the result.
		"/": homepage,

		"/api/fints": {
			async POST(req) {
				return await handleFinTSRequest(req);
			},
		},
	},

	// Enable development mode for:
	// - Detailed error messages
	// - Hot reloading (Bun v1.2.3+ required)
	development: {
		hmr: true, // Enable Hot Module Replacement
		console: true,
	},

	// Prior to v1.2.3, the `fetch` option was used to handle all API requests. It is now optional.
	// async fetch(req) {
	//   // Return 404 for unmatched routes
	//   return new Response("Not Found", { status: 404 });
	// },
});

console.log(`Listening on ${server.url}`);
