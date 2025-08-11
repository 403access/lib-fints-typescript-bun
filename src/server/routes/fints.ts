/*
  FinTS API handler for Bun server
  
  This handler has been refactored into multiple modules.
  This file now serves as a simple proxy to the modular implementation.
*/

export { handleFinTSRequest } from "../fints/index.js";
