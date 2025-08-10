import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { default as Component } from "./App";
// Optionally: import your app's CSS
// import "./styles.css";

const elem = document.getElementById("root");
if (!elem) {
  throw new Error("Root element not found. Ensure your HTML has a <div id='root'></div>.");
}

const getRootElement = () => {
  if (import.meta.hot) {
    // With hot module reloading, `import.meta.hot.data` is persisted.
    const root = (import.meta.hot.data.root ??= createRoot(elem));
    return root;
  } else {
    // The hot module reloading API is not available in production.
    return createRoot(elem);
  }
}

const app = (
  <StrictMode>
    <Component />
  </StrictMode>
);

const mount = () => {
  const root = getRootElement();
  root.render(app);
}

mount()