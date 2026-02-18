# MCP Factory: LinkedIn-Ready Production-Grade Fixes

**Date:** 2026-02-18
**Goal:** Fix all issues preventing generated MCP servers from working against real APIs. Demo target: Spotify API.
**Approach:** Add a preprocessing context builder (Approach B) between the analyzer and templates.

---

## Problem Summary

Generated servers compile but don't work against real APIs due to 7 issues:

| # | Issue | Severity | Root Cause |
|---|-------|----------|------------|
| 1 | Bad tool names (`get_13`, `listUsingGET`) | High | Fallback operationId generation in `openapi.ts:162` |
| 2 | No auth headers in generated client | High | Template can't access full auth config; analyzer reduces to string |
| 3 | Path params not substituted (`/tracks/{id}` sent literally) | High | No URL templating in client or tools template |
| 4 | Query params sent as JSON body | High | All params mixed into one bag; client always sends body |
| 5 | POST bodies empty (`properties: {}`) | Medium | Template loops only `parameters`, ignores `requestBody` |
| 6 | types.ts and validation.ts are empty stubs | Medium | Templates never implemented |
| 7 | 0 tests, README accuracy issues | Low | Placeholders, stale claims |

---

## Architecture Change

### Current Flow
```
Parser (openapi.ts) → Analyzer (analyzer.ts) → Templates (*.hbs) → Generated files
```
Information is lost at each stage. Parser extracts param locations but templates ignore them. Analyzer reduces auth to a string.

### New Flow
```
Parser (openapi.ts) → Analyzer (analyzer.ts) → Context Builder (NEW) → Templates (*.hbs) → Generated files
```
The context builder transforms raw parsed data into a render-ready structure. Templates become simple loops with no data transformation.

---

## Section 1: Context Builder + Parameter Handling

**New file:** `src/generator/context-builder.ts`

### EndpointContext shape

```typescript
interface ParamContext {
  name: string;
  type: string;         // "string" | "integer" | "number" | "boolean" | "array" | "object"
  required: boolean;
  description?: string;
  schema?: SchemaType;  // full schema for complex types
}

interface EndpointContext {
  toolName: string;           // "getTrack", "searchPlaylists"
  description: string;
  method: string;
  pathTemplate: string;       // "/tracks/{id}"
  pathParams: ParamContext[];
  queryParams: ParamContext[];
  bodyParams: ParamContext[];
  hasBody: boolean;
  allParams: ParamContext[];   // union for MCP inputSchema
  requiredParams: string[];
}
```

### Tool name generation

Priority order:
1. `operationId` if present and not auto-generated (reject patterns like `listUsingGET`, `get_3`)
2. Derive from method + last meaningful path segment: `GET /tracks/{id}` -> `getTrack`
3. Deduplicate collisions with numeric suffix: `getTrack`, `getTrack_2`

Detection of bad operationIds: reject if matches `/(get|post|put|patch|delete|list|add|update|remove|create|link|search|Using(GET|POST|PUT|PATCH|DELETE)|\w+_\d+$)/i` patterns that suggest auto-generation.

### Client request signature

```typescript
request(method: string, pathTemplate: string, options: {
  pathParams?: Record<string, string>;
  queryParams?: Record<string, string>;
  body?: any;
}) => Promise<any>
```

- Path params: replace `{id}` in template with actual values
- Query params: append as URL search params
- Body: JSON.stringify for POST/PUT/PATCH only

### Generated tool handler

```typescript
// tools.ts (generated)
if (name === 'getTrack') {
  const result = await client.request('GET', '/tracks/{id}', {
    pathParams: { id: args.id },
    queryParams: { market: args.market },
  });
  return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
}
```

---

## Section 2: Auth Handling

Pass full auth config from parser through context builder to templates. No lossy reduction.

### Auth types supported

| Auth Type | Location | Generated Code |
|-----------|----------|---------------|
| `bearer` | header | `headers['Authorization'] = 'Bearer ' + process.env.{API}_API_TOKEN` |
| `api-key` | header | `headers['{headerName}'] = process.env.{API}_API_KEY` |
| `api-key` | query | Appended to URL as query param |
| `oauth` | header | `headers['Authorization'] = 'Bearer ' + process.env.{API}_ACCESS_TOKEN` |
| `basic` | header | `headers['Authorization'] = 'Basic ' + btoa(user + ':' + pass)` |

### Env var naming

Derived from API name: `Spotify Web API` -> `SPOTIFY_WEB_API_TOKEN`. Generated README documents required env vars.

---

## Section 3: Types + Zod Validation

### $ref resolution

New utility: `resolveRef(spec, $ref)` in parser that follows JSON pointer references to `components/schemas/*` and returns the resolved schema object.

### types.ts generation

- Named schemas from `components/schemas` -> top-level TypeScript interfaces
- Per-endpoint: `{ToolName}Params` interface for inputs, `{ToolName}Response` interface for outputs
- Nested objects resolved recursively
- Arrays typed with item type

Example output:
```typescript
export interface Track {
  id: string;
  name: string;
  artists: Artist[];
  duration_ms: number;
}

export interface GetTrackParams {
  id: string;
  market?: string;
}
```

### validation.ts generation

- Zod schemas for input params only (runtime validation before API call)
- Response types are TypeScript-only (trust the API)

Example output:
```typescript
import { z } from 'zod';

export const GetTrackParamsSchema = z.object({
  id: z.string(),
  market: z.string().optional(),
});
```

### Validation integration

In generated `handleToolCall`:
```typescript
const validated = GetTrackParamsSchema.parse(args);
```
This runs before the API call, catching bad input with clear Zod error messages.

---

## Section 4: Tests + README

### Test layers

1. **Unit: context-builder** — Given known APISchema, verify tool names, param separation, path resolution.
2. **Integration: generate + compile** — `mcp-factory create weather-fixture` then `tsc --noEmit`. Proves valid TypeScript.
3. **Snapshot: Spotify** — Generate from Spotify spec, assert key tools exist with correct names, auth is bearer, params in right buckets.

### README fixes

- Remove "308 tools" -> use actual count or "hundreds of tools"
- Remove "smoke tests included" -> "input validation with Zod"
- Update feature checklist to match post-fix reality
- Fix `README.md.hbs` to show correct env var names

---

## Files Changed

| File | Change Type | Description |
|------|------------|-------------|
| `src/generator/context-builder.ts` | **New** | Preprocessing layer: param separation, tool naming, auth passthrough |
| `src/generator/engine.ts` | Modify | Use context builder output instead of raw schema |
| `src/parsers/openapi.ts` | Modify | Add $ref resolution, improve requestBody extraction |
| `templates/client.ts.hbs` | Rewrite | New request signature with path/query/body separation, auth injection |
| `templates/tools.ts.hbs` | Rewrite | Use EndpointContext, separate param bags in handler |
| `templates/types.ts.hbs` | Rewrite | Generate real TypeScript interfaces |
| `templates/validation.ts.hbs` | Rewrite | Generate real Zod schemas |
| `templates/README.md.hbs` | Modify | Correct env var names, accurate feature list |
| `src/schema/api-schema.ts` | Modify | Add TemplateContext types |
| `README.md` | Modify | Fix accuracy (tool count, feature claims) |
| `src/tests/context-builder.test.ts` | **New** | Unit tests for context builder |
| `src/tests/integration.test.ts` | **New** | Generate + compile integration test |
| `test-fixtures/spotify-openapi.yaml` | **New** | Spotify OpenAPI spec for testing |

---

## Demo Target

After all fixes, this workflow works end-to-end:

```bash
mcp-factory create ./spotify-openapi.yaml
cd "Spotify Web API-mcp"
npm install && npm run build
mcp-factory install "Spotify Web API"
# Add SPOTIFY_ACCESS_TOKEN to Claude config
# Ask Claude: "Search for Taylor Swift tracks on Spotify"
# Claude calls searchTracks tool -> real API response
```

This is the screen-recordable moment for LinkedIn.
