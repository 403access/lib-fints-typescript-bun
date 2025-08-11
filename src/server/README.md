# FinTS Server Sync Module

This module provides server-side FinTS banking synchronization functionality with support for TAN authentication, including push TAN polling.

## Module Structure

The sync functionality has been refactored into focused, single-responsibility modules:

### Core Files

- **`sync.ts`** - Main synchronization logic
- **`types.ts`** - TypeScript type definitions
- **`tanHandler.ts`** - TAN authentication with push polling
- **`tanCallbacks.ts`** - Pre-built TAN callback implementations
- **`validation.ts`** - Credential validation utilities
- **`index.ts`** - Barrel export for clean imports

### Key Features

- ✅ **Push TAN Support**: Automatic polling for mobile app approval
- ✅ **SMS TAN Support**: Interactive TAN input for SMS-based authentication
- ✅ **Multiple Callback Types**: Command-line and automated callbacks
- ✅ **Comprehensive Error Handling**: Detailed error messages and bank responses
- ✅ **TypeScript**: Full type safety and IntelliSense support

## Usage Examples

### Basic Import

```typescript
import { 
  syncAllStatements, 
  createCommandLineTanCallback 
} from './src/server/index.js';
```

### Interactive Sync with TAN Support

```typescript
import { 
  syncAllStatements, 
  createCommandLineTanCallback,
  validateCredentials 
} from './src/server/index.js';

const credentials = {
  productId: "YOUR_PRODUCT_ID",
  productVersion: "1.0.0",
  bankUrl: "https://banking.example.com/fints30",
  bankId: "12345678",
  userId: "your-user-id",
  pin: "your-pin"
};

// Validate credentials
const errors = validateCredentials(credentials);
if (errors.length > 0) {
  console.error("Invalid credentials:", errors);
  return;
}

// Create TAN callback for interactive authentication
const tanCallback = createCommandLineTanCallback();

// Sync all statements
const result = await syncAllStatements(credentials, {}, tanCallback);

if (result.success) {
  console.log("Statements retrieved:", result.data?.statements);
} else {
  console.error("Sync failed:", result.error);
}
```

### Automated Push TAN Only

```typescript
import { 
  syncAllStatements, 
  createAutomaticPushTanCallback 
} from './src/server/index.js';

// For headless scenarios where only push TAN is expected
const automaticCallback = createAutomaticPushTanCallback((challenge, reference) => {
  console.log("Push TAN initiated:", challenge);
  // Send notification, log event, etc.
});

const result = await syncAllStatements(credentials, {}, automaticCallback);
```

### Custom TAN Callback

```typescript
import { 
  syncAllStatements,
  type TanCallback 
} from './src/server/index.js';

const customTanCallback: TanCallback = async (challenge, reference, bankAnswers) => {
  // Your custom TAN handling logic
  if (isPushTan(bankAnswers)) {
    await sendPushNotification(challenge);
    return { tan: "" }; // Empty for push TAN
  } else {
    const tan = await getSMSTanFromDatabase(reference);
    return { tan };
  }
};
```

### Account-Specific Sync

```typescript
import { syncAccountStatements } from './src/server/index.js';

// Sync specific account with date range
const result = await syncAccountStatements(
  credentials,
  "DE89370400440532013000", // IBAN
  {
    startDate: new Date('2024-01-01'),
    endDate: new Date('2024-12-31')
  },
  tanCallback
);
```

## Module Details

### `types.ts`
Contains all TypeScript interfaces and type definitions:
- `SyncCredentials`
- `TanCallback` 
- `SyncResult`
- `PushTanPollingOptions`
- And more...

### `tanHandler.ts`
Core TAN authentication logic:
- `handlePushTanWithPolling()` - Manages push TAN polling with configurable options
- Supports both push TAN and regular TAN authentication
- Automatic retry logic with timeout handling

### `tanCallbacks.ts`
Ready-to-use TAN callback implementations:
- `createCommandLineTanCallback()` - Interactive command-line TAN input
- `createAutomaticPushTanCallback()` - Headless push TAN handling

### `validation.ts`
Credential validation utilities:
- `validateCredentials()` - Checks for required fields

### `sync.ts`
Main synchronization functions:
- `syncAllStatements()` - Retrieve statements from all accounts
- `syncAccountStatements()` - Retrieve statements from specific account

## Migration from Old sync.ts

If you were using the previous monolithic `sync.ts` file, the migration is simple:

**Before:**
```typescript
import { syncAllStatements } from './sync.js';
```

**After:**
```typescript
import { syncAllStatements } from './index.js';
// or directly from sync.js
import { syncAllStatements } from './sync.js';
```

All function signatures and behaviors remain the same. The refactoring only improved code organization and maintainability.

## Push TAN Configuration

The push TAN polling can be configured with these options:

```typescript
const pollingOptions = {
  maxAttempts: 60,    // Maximum number of polling attempts
  intervalMs: 5000,   // Milliseconds between attempts
  timeoutMs: 300000   // Total timeout in milliseconds (5 minutes)
};

// These options are passed internally to handlePushTanWithPolling
```

## Error Handling

All functions return detailed error information:

```typescript
const result = await syncAllStatements(credentials, {}, tanCallback);

if (!result.success) {
  console.error("Error:", result.error);
  console.log("Banking info:", result.bankingInformation);
}
```

## Testing

Run the demo script to test the functionality:

```bash
bun run src/server/demo-sync.ts
```

Make sure to set the required environment variables:
- `FINTS_PRODUCT_REGISTER_ID`
- `FINTS_USER_ID` 
- `FINTS_PIN`
