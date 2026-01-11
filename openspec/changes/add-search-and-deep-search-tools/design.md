## Context

The current `deep_research` tool is a simple wrapper that sends one prompt to Gemini CLI and waits for the result. The research iteration happens entirely inside the Gemini CLI, which the MCP server cannot control or monitor.

Users want:
1. **Quick searches**: Simple queries that don't need multiple iterations
2. **Controlled deep searches**: Server-orchestrated iterations with verification loops

## Goals / Non-Goals

### Goals
- Implement server-side orchestration of multi-round research
- Provide granular control over search depth and iteration count
- Enable verification loops where intermediate results are fed back for validation
- Maintain backward compatibility with existing `deep_research` tool

### Non-Goals
- Implementing custom search (still delegate to Gemini CLI with Google Search + Firecrawl)
- Changing the underlying Gemini CLI behavior
- Modifying the Firecrawl MCP integration

## Decisions

### 1. Single-Round Search (`search`)

**Decision**: Create a dedicated tool for one-shot searches.

**Rationale**: Users often need quick answers without the overhead of deep research. This is lighter and faster.

**Flow**:
```
MCP Server → Gemini CLI → Google Search (once) → Fetch promising pages → Return result
```

### 2. Multi-Round Deep Search (`deep_search`)

**Decision**: Implement server-side iteration loop with intermediate result passing.

**Rationale**: Server can control the iteration count and feed intermediate results back for verification.

**Flow**:
```
Round 1: MCP Server → Gemini CLI → 5-perspective search → Temp result
Round 2+: MCP Server → Gemini CLI (with temp result) → Verification search → Updated result
... up to 5 rounds or until verified
```

### 3. Verification Loop Design

**Decision**: Use a dedicated verification prompt that includes:
- Original query
- Current temporary result
- Request to verify and update

**Rationale**: Separating verification from initial research ensures Gemini focuses on validation rather than new research.

**Alternatives considered**:
- Single prompt with "iterate until satisfied" → Rejected: Cannot control or monitor iteration count
- External verification service → Rejected: Adds complexity and dependency

### 4. Completion Criteria

**Decision**: Loop completes when either:
- Maximum iterations reached (configurable, default: 5)
- Gemini returns `verified: true` in response

**Rationale**: Balances thoroughness with resource constraints.

## Risks / Trade-offs

### Risk: Increased Latency
**Risk**: Multi-round communication with Gemini CLI increases total time
**Mitigation**: Provide `search` tool for quick queries; make iteration count configurable

### Risk: Token Accumulation
**Risk**: Each round accumulates context (original + temp result)
**Mitigation**: Cap iterations at 5 by default; prompt Gemini to keep temp results concise

### Risk: Gemini CLI Compatibility
**Risk**: Assuming Gemini CLI can handle the back-and-forth pattern
**Mitigation**: Test thoroughly; provide fallback to original `deep_research` if needed

## Migration Plan

No migration needed - this is additive. Existing `deep_research` tool remains unchanged.

## Open Questions

1. Should `deep_search` include the intermediate results in the final response, or just the final verified result?
   - **Decision**: Include both - final result plus metadata with iteration count and sources per round

2. Should we expose the current round number to the user during execution?
   - **Decision**: Yes, via progress logs to stderr (e.g., `[INFO] Deep search round 2/5...`)

3. What happens if verification round fails to improve the result?
   - **Decision**: Return the best result obtained with a note about verification status
