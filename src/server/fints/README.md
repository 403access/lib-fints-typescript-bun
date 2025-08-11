# FinTS Server Module Structure

This directory contains the refactored FinTS server implementation, broken down into smaller, more maintainable modules.

## Directory Structure

```
src/server/fints/
├── index.ts              # Main request handler and routing
├── types.ts              # TypeScript type definitions
├── session.ts            # Session management functionality
└── handlers/             # Individual action handlers
    ├── index.ts          # Handler exports
    ├── startSession.ts   # Initial session setup and sync
    ├── selectTan.ts      # TAN method selection
    ├── synchronize.ts    # Account synchronization
    ├── getAccountBalance.ts      # Single account balance
    ├── getAccountStatements.ts   # Single account statements
    ├── getAllBalances.ts         # Batch balance retrieval
    ├── getAllStatements.ts       # Batch statements retrieval
    └── submitTan.ts              # TAN submission and processing
```

## Module Responsibilities

### `types.ts`
- Defines all TypeScript interfaces and types
- Includes Session, FinTSRequest, FinTSResponse types
- Provides type safety across all modules

### `session.ts`
- Manages client sessions using signed cookies
- Handles session creation, retrieval, and cleanup
- Maintains in-memory session storage (replace with proper store in production)

### `handlers/`
Each handler is responsible for a specific FinTS operation:

- **startSession**: Creates new FinTS client and performs initial sync
- **selectTan**: Handles TAN method and media selection
- **synchronize**: Syncs account information and banking parameters
- **getAccountBalance**: Retrieves balance for a specific account
- **getAccountStatements**: Retrieves statements for a specific account
- **getAllBalances**: Batch operation to get balances for all accounts
- **getAllStatements**: Batch operation to get statements for all accounts
- **submitTan**: Processes TAN input for pending operations

### `index.ts`
- Main request handler that orchestrates all operations
- Routes requests to appropriate handlers
- Handles common error cases and session validation
- Maintains backwards compatibility with existing API

## Usage

The refactored code maintains the same API interface as before. The original route file (`routes/fints.ts`) now simply exports the main handler from this modular implementation.

```typescript
import { handleFinTSRequest } from "../fints";
```

## Future Improvements

1. Replace in-memory session storage with Redis or database
2. Add comprehensive error handling and logging
3. Implement rate limiting and security measures
4. Add request/response validation schemas
5. Create integration tests for each handler
6. Add OpenAPI/Swagger documentation
