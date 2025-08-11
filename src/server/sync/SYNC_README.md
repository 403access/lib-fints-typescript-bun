# FinTS Sync Module

Enhanced server-side entry point for retrieving bank statements with full TAN authentication support.

## Features

✅ **TAN Authentication Support** - Interactive TAN handling with customizable callbacks  
✅ **Push TAN Support** - Automatic polling for mobile app push notifications  
✅ **Reused Project Types** - Leverages existing `FinTSForm`, `BankAnswer`, and `BankingInformation` types  
✅ **Batch Account Processing** - Retrieve statements from all accounts or filter by specific account  
✅ **Date Range Filtering** - Optional start/end date parameters  
✅ **Comprehensive Error Handling** - Detailed error reporting with partial success handling  
✅ **Command-Line Ready** - Built-in CLI TAN callback for interactive use  
✅ **Headless Support** - Automatic push TAN callback for unattended operations  
✅ **TypeScript Support** - Full type safety throughout  

## Quick Start

### Basic Usage

```typescript
import { syncAllStatements, createCommandLineTanCallback } from './sync.js';

const credentials = {
  productId: "YOUR_REGISTERED_PRODUCT_ID",
  productVersion: "1.0.0", 
  bankUrl: "https://your-bank-fints-url",
  bankId: "YOUR_BANK_BLZ",
  userId: "YOUR_USER_ID",
  pin: "YOUR_PIN"
};

// Create interactive TAN callback
const tanCallback = createCommandLineTanCallback();

// Sync all accounts
const result = await syncAllStatements(credentials, {}, tanCallback);

if (result.success) {
  console.log("✅ Statements retrieved!");
  console.log(`Found ${Object.keys(result.data.statements).length} accounts`);
} else {
  console.error("❌ Error:", result.error);
}
```

### Custom TAN Callback

```typescript
import type { TanCallback } from './sync.js';

const customTanCallback: TanCallback = async (tanChallenge, tanReference, bankAnswers) => {
  // Your custom TAN handling logic
  console.log("TAN Challenge:", tanChallenge);
  
  // Example: Get TAN from external source, UI, etc.
  const tan = await getFromSomewhere();
  
  return { tan }; // or { tan: '', cancel: true } to cancel
};

const result = await syncAllStatements(credentials, {}, customTanCallback);
```

### Account-Specific Sync

```typescript
// Sync specific account with date range
const result = await syncAccountStatements(
  credentials,
  "1234567890", // Account number or IBAN
  {
    startDate: new Date('2024-01-01'),
    endDate: new Date('2024-12-31')
  },
  tanCallback
);
```

### Push TAN Support

The module automatically detects push TAN (mobile app) authentication and handles polling:

```typescript
import { createCommandLineTanCallback, createAutomaticPushTanCallback } from './sync.js';

// Interactive callback - handles both SMS and push TAN
const interactiveCallback = createCommandLineTanCallback();

// Automatic callback - only for push TAN, throws error for SMS
const pushOnlyCallback = createAutomaticPushTanCallback((challenge, reference) => {
  console.log(`📱 Push TAN detected: ${challenge}`);
  // Optional: Send notification, log to system, etc.
});

// Custom callback with push TAN detection
const customCallback = async (challenge, reference, bankAnswers) => {
  const { isDecoupledTanChallenge } = await import('../client/utils/fintsUtils.js');
  
  if (isDecoupledTanChallenge(bankAnswers)) {
    console.log("📱 Please approve in your banking app");
    await sendPushNotification(challenge); // Your notification logic
    return { tan: "" }; // Empty TAN for push authentication
  } else {
    const tan = await promptUserForSMSTan(challenge);
    return { tan };
  }
};
```

**Push TAN Polling Configuration:**
- **Max Attempts:** 60 (configurable)  
- **Interval:** 5 seconds between checks  
- **Timeout:** 5 minutes total  
- **Automatic Retry:** Continues until approval or timeout  

## API Reference

### Functions

#### `syncAllStatements(credentials, options?, tanCallback?)`

Retrieve statements from all accounts or filtered accounts.

**Parameters:**
- `credentials: SyncCredentials` - Banking credentials (reuses `FinTSForm` type)
- `options?: AccountStatementsOptions` - Optional filtering
  - `accountNumber?: string` - Specific account to sync
  - `startDate?: Date` - Filter from date
  - `endDate?: Date` - Filter to date
- `tanCallback?: TanCallback` - Optional TAN authentication handler

**Returns:** `Promise<SyncResult>`

#### `syncAccountStatements(credentials, accountNumber, options?, tanCallback?)`

Convenience function for single account sync.

#### `createCommandLineTanCallback()`

Creates an interactive command-line TAN callback. Automatically detects and handles both SMS and push TAN.

**Returns:** `TanCallback`

#### `createAutomaticPushTanCallback(onPushTanDetected?)`

Creates an automatic push TAN callback for headless scenarios.

**Parameters:**
- `onPushTanDetected?: (challenge: string, reference: string) => void` - Optional notification callback

**Returns:** `TanCallback` - Throws error if SMS TAN is encountered

**Note:** Only handles push TAN. Throws an error if SMS TAN input is required.

Creates an interactive command-line TAN callback.

#### `validateCredentials(credentials)`

Validates credential completeness.

### Types

#### `SyncCredentials`

```typescript
type SyncCredentials = FinTSForm; // Reuses existing project type
```

#### `TanCallback`

```typescript
type TanCallback = (
  tanChallenge: string,
  tanReference: string, 
  bankAnswers?: BankAnswer[]
) => Promise<TanCallbackResult>;
```

#### `SyncResult`

```typescript
interface SyncResult {
  success: boolean;
  data?: {
    statements: Record<string, unknown>;
    accounts: Array<{
      accountNumber: string;
      iban?: string;
      currency?: string;
    }>;
  };
  error?: string;
  bankingInformation?: BankingInformation;
}
```

## Demo Script

Run the included demo to test functionality:

```bash
# Set environment variables
export FINTS_PRODUCT_ID="your-registered-product-id"
export FINTS_USER_ID="your-user-id"  
export FINTS_PIN="your-pin"

# Run demo
bun run src/server/demo-sync.ts
```

## TAN Authentication Flow

### Standard SMS TAN Flow
1. **Initial Sync** - Attempts bank synchronization
2. **TAN Challenge** - Bank requires SMS TAN
3. **User Input** - User enters TAN from SMS
4. **TAN Submission** - Submits TAN and continues operation
5. **Statement Retrieval** - Fetches statements

### Push TAN Flow (New!)
1. **Initial Sync** - Attempts bank synchronization  
2. **Push TAN Challenge** - Bank sends push notification to mobile app
3. **Automatic Detection** - System detects push TAN based on response codes
4. **User Notification** - Informs user to approve in banking app
5. **Polling Loop** - Automatically polls bank every 5 seconds
6. **Approval Detection** - Continues when user approves in app
7. **Statement Retrieval** - Fetches statements automatically

**Push TAN Response Codes Detected:**
- `3060` - Strong authentication required / decoupled TAN pending
- `3076` - Decoupled TAN not yet approved  
- Error messages containing "noch nicht freigegeben", "not yet approved", etc.

### Mixed TAN Environments
The system handles banks that use different TAN methods for different operations:
- Initial sync might use push TAN
- Individual account statements might use SMS TAN  
- Each operation is handled independently with appropriate polling/input

## Error Handling

The module provides comprehensive error handling:

- **Credential Validation** - Checks required fields before operation
- **TAN Failures** - Detailed error messages from bank responses
- **Partial Success** - Reports which accounts succeeded/failed in batch operations
- **Banking Information** - Always returns available banking details, even on failure

## Security Notes

- Credentials are only used for the duration of the sync operation
- TAN callbacks receive challenge details but sensitive data is not logged
- Banking communication uses the secure lib-fints library
- No credentials are stored or cached

## Integration Examples

### Scheduled Jobs

```typescript
// cron-job.ts
import { syncAllStatements } from './sync.js';

// Non-interactive TAN callback for automated scenarios
const automatedTanCallback = async () => {
  // Return cancel if TAN required in automated context
  return { tan: '', cancel: true };
};

export async function dailySync() {
  const result = await syncAllStatements(credentials, {}, automatedTanCallback);
  
  if (!result.success && result.error?.includes('TAN')) {
    console.log('TAN required - skipping automated sync');
    return;
  }
  
  // Process results...
}
```

### Web API Integration

```typescript
// api-handler.ts  
export async function handleSyncRequest(req, res) {
  const tanCallback = async (challenge, reference) => {
    // Send TAN challenge to user via WebSocket, email, etc.
    const tan = await waitForUserTanInput(challenge, reference);
    return { tan };
  };
  
  const result = await syncAllStatements(credentials, {}, tanCallback);
  res.json(result);
}
```
