# Cost Tracking Service

Provides cost calculation, currency conversion, and financial tracking for AI service usage.

## Features

- **Cost Calculation**: Calculate costs based on token usage and provider pricing
- **Currency Conversion**: USD to PKR conversion with real-time rates
- **Usage Tracking**: Track daily and monthly usage tokens per API key
- **Cost Aggregation**: Aggregate costs by provider, gate, and topic
- **Metrics**: Calculate cost per conversation, AI call rate, cache hit rate
- **Projections**: Project month-end costs based on current burn rate
- **Recommendations**: Generate cost optimization recommendations
- **Accuracy**: Maintain accuracy to 4 decimal places USD, 2 decimal places PKR

## API Reference

### Cost Calculation

#### `calculateCost(tokensUsed, pricingPer1kTokens, exchangeRate?)`

Calculate cost from tokens and pricing.

**Parameters:**
- `tokensUsed` (number): Number of tokens used
- `pricingPer1kTokens` (number): Pricing per 1000 tokens in USD
- `exchangeRate` (number, optional): Exchange rate (USD to PKR), defaults to 278.5

**Returns:**
```typescript
{
  tokensUsed: number;
  pricingPer1kTokens: number;
  costUsd: number;  // Accurate to 4 decimal places
  costPkr: number;  // Accurate to 2 decimal places
}
```

**Example:**
```typescript
const result = calculateCost(1000, 0.01, 278.5);
// { tokensUsed: 1000, pricingPer1kTokens: 0.01, costUsd: 0.01, costPkr: 2.79 }
```

### Currency Conversion

#### `convertUsdToPkr(usdAmount, exchangeRate?)`

Convert USD to PKR.

**Parameters:**
- `usdAmount` (number): Amount in USD
- `exchangeRate` (number, optional): Exchange rate (USD to PKR), defaults to 278.5

**Returns:** Amount in PKR (accurate to 2 decimal places)

**Example:**
```typescript
const pkr = convertUsdToPkr(1, 278.5);
// 278.5
```

#### `convertPkrToUsd(pkrAmount, exchangeRate?)`

Convert PKR to USD.

**Parameters:**
- `pkrAmount` (number): Amount in PKR
- `exchangeRate` (number, optional): Exchange rate (USD to PKR), defaults to 278.5

**Returns:** Amount in USD (accurate to 4 decimal places)

**Example:**
```typescript
const usd = convertPkrToUsd(278.5, 278.5);
// 1.0
```

#### `getExchangeRate()`

Get current exchange rate (USD to PKR).

**Returns:** Exchange rate as number

**Example:**
```typescript
const rate = await getExchangeRate();
// 278.5
```

### Usage Tracking

#### `trackKeyUsage(keyId, tokensUsed)`

Track key usage (update daily and monthly tokens).

**Parameters:**
- `keyId` (string): API key ID
- `tokensUsed` (number): Tokens used in this call

**Returns:**
```typescript
{
  dailyUsageTokens: number;
  monthlyUsageTokens: number;
}
```

**Example:**
```typescript
const usage = await trackKeyUsage('key-123', 1000);
// { dailyUsageTokens: 1000, monthlyUsageTokens: 5000 }
```

#### `resetDailyUsage(tenantId)`

Reset daily usage tokens (called at midnight).

**Parameters:**
- `tenantId` (string): Tenant ID

**Returns:** Number of keys updated

#### `resetMonthlyUsage(tenantId)`

Reset monthly usage tokens (called on first day of month).

**Parameters:**
- `tenantId` (string): Tenant ID

**Returns:** Number of keys updated

### Cost Recording

#### `recordCostTransaction(tenantId, providerId, tokensUsed, costUsd, costPkr, options?)`

Record cost transaction in cost_records table.

**Parameters:**
- `tenantId` (string): Tenant ID
- `providerId` (string): Provider ID
- `tokensUsed` (number): Tokens used
- `costUsd` (number): Cost in USD
- `costPkr` (number): Cost in PKR
- `options` (object, optional):
  - `keyId` (string): API key ID
  - `gateNumber` (number): Gate number (1-4)
  - `topicId` (string): Topic ID
  - `conversationId` (string): Conversation ID

**Returns:** Created CostRecord

**Example:**
```typescript
const record = await recordCostTransaction(
  'tenant-123',
  'provider-456',
  1000,
  0.01,
  2.79,
  { gateNumber: 4, conversationId: 'conv-789' }
);
```

### Cost Summary

#### `getCostSummary(tenantId)`

Get comprehensive cost summary for tenant.

**Parameters:**
- `tenantId` (string): Tenant ID

**Returns:**
```typescript
{
  totalSpendThisMonth: number;
  totalSpendLastMonth: number;
  trendIndicator: 'up' | 'down' | 'stable';
  costByProvider: CostByProvider[];
  costByGate: CostByGate[];
  costByTopic: CostByTopic[];
  costPerConversation: number;
  aiCallRate: number;
  cacheHitRate: number;
  projectedMonthEndCost: number;
  qualityVsCostAnalysis: QualityVsCostAnalysis[];
  recommendations: string[];
}
```

### Cost Aggregation

#### `getCostByProvider(tenantId, startDate)`

Get costs broken down by provider.

**Parameters:**
- `tenantId` (string): Tenant ID
- `startDate` (Date): Start date for filtering

**Returns:** Array of CostByProvider

#### `getCostByGate(tenantId, startDate)`

Get costs broken down by gate.

**Parameters:**
- `tenantId` (string): Tenant ID
- `startDate` (Date): Start date for filtering

**Returns:** Array of CostByGate

#### `getCostByTopic(tenantId, startDate)`

Get costs broken down by topic.

**Parameters:**
- `tenantId` (string): Tenant ID
- `startDate` (Date): Start date for filtering

**Returns:** Array of CostByTopic

### Metrics

#### `calculateCostPerConversation(tenantId, startDate)`

Calculate average cost per conversation.

**Parameters:**
- `tenantId` (string): Tenant ID
- `startDate` (Date): Start date for filtering

**Returns:** Average cost per conversation in USD

#### `calculateAiCallRate(tenantId, startDate)`

Calculate AI call rate (percentage of conversations that used AI).

**Parameters:**
- `tenantId` (string): Tenant ID
- `startDate` (Date): Start date for filtering

**Returns:** AI call rate as percentage

#### `calculateCacheHitRate(tenantId, startDate)`

Calculate cache hit rate (percentage of calls that hit cache).

**Parameters:**
- `tenantId` (string): Tenant ID
- `startDate` (Date): Start date for filtering

**Returns:** Cache hit rate as percentage

#### `getProjectedMonthlyCost(tenantId)`

Get projected month-end cost based on current burn rate.

**Parameters:**
- `tenantId` (string): Tenant ID

**Returns:** Projected cost for the month in USD

### Analysis & Recommendations

#### `getQualityVsCostAnalysis(tenantId, startDate)`

Get quality vs cost analysis.

**Parameters:**
- `tenantId` (string): Tenant ID
- `startDate` (Date): Start date for filtering

**Returns:** Array of QualityVsCostAnalysis

#### `getCostRecommendations(tenantId, startDate)`

Get cost optimization recommendations.

**Parameters:**
- `tenantId` (string): Tenant ID
- `startDate` (Date): Start date for filtering

**Returns:** Array of recommendation strings

### Retrieval

#### `getCostRecords(tenantId, filter?)`

Get cost records with filtering.

**Parameters:**
- `tenantId` (string): Tenant ID
- `filter` (object, optional):
  - `providerId` (string): Filter by provider
  - `gateNumber` (number): Filter by gate
  - `topicId` (string): Filter by topic
  - `startDate` (Date): Filter by start date
  - `endDate` (Date): Filter by end date
  - `limit` (number): Limit results
  - `offset` (number): Offset for pagination

**Returns:** Array of CostRecord

## Accuracy Guarantees

- **USD Precision**: 4 decimal places (e.g., 0.0001)
- **PKR Precision**: 2 decimal places (e.g., 0.01)
- **Rounding**: All calculations use proper rounding to prevent accumulation of errors
- **Round-Trip Conversion**: USD → PKR → USD conversion maintains accuracy within 0.01 USD

## Examples

### Calculate cost for an AI call

```typescript
import * as costTracking from './cost-tracking';

// Calculate cost for 1000 tokens at $0.01 per 1k tokens
const cost = costTracking.calculateCost(1000, 0.01);
console.log(`Cost: $${cost.costUsd} USD or ₨${cost.costPkr} PKR`);
// Output: Cost: $0.01 USD or ₨2.79 PKR
```

### Track usage and record cost

```typescript
import * as costTracking from './cost-tracking';

// Track usage
const usage = await costTracking.trackKeyUsage('key-123', 1000);
console.log(`Daily usage: ${usage.dailyUsageTokens} tokens`);

// Record cost
const record = await costTracking.recordCostTransaction(
  'tenant-123',
  'provider-456',
  1000,
  0.01,
  2.79,
  { gateNumber: 4, conversationId: 'conv-789' }
);
console.log(`Cost recorded: $${record.costUsd}`);
```

### Get cost summary

```typescript
import * as costTracking from './cost-tracking';

const summary = await costTracking.getCostSummary('tenant-123');
console.log(`This month: $${summary.totalSpendThisMonth}`);
console.log(`Last month: $${summary.totalSpendLastMonth}`);
console.log(`Trend: ${summary.trendIndicator}`);
console.log(`Projected month-end: $${summary.projectedMonthEndCost}`);
console.log(`Recommendations:`);
summary.recommendations.forEach(rec => console.log(`  - ${rec}`));
```

### Get cost breakdown

```typescript
import * as costTracking from './cost-tracking';

const byProvider = await costTracking.getCostByProvider('tenant-123', new Date());
console.log('Cost by provider:');
byProvider.forEach(p => {
  console.log(`  ${p.providerName}: $${p.costUsd} (${p.percentage}%)`);
});

const byGate = await costTracking.getCostByGate('tenant-123', new Date());
console.log('Cost by gate:');
byGate.forEach(g => {
  console.log(`  Gate ${g.gateNumber}: $${g.costUsd} (${g.percentage}%)`);
});
```

## Testing

Run tests with:

```bash
npm run test lib/cost-tracking/index.test.ts
```

Test coverage includes:
- Cost calculation accuracy (4 decimal places USD, 2 decimal places PKR)
- Currency conversion (USD to PKR, PKR to USD)
- Usage tracking (daily, monthly aggregation)
- Cost aggregation (by provider, gate, topic)
- Projections and recommendations
- Multi-tenant isolation
- Error handling

## Requirements

- **9.1**: Cost Intelligence & Financial Tracking
- **9.10**: Cost calculation accuracy (4 decimal places USD, 2 decimal places PKR)
- **12.2**: Email Association for Billing & Notifications

## Related Services

- **Activity Logging**: Records all cost transactions for audit trail
- **Database**: Stores cost records in `cost_records` table
- **API Keys**: Tracks usage tokens in `api_keys` table
