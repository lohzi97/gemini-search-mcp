#!/bin/bash
# AI Permission Review Hook for Claude Code
# Save as: .claude/hooks/ai-permission-review.sh
# Make executable: chmod +x .claude/hooks/ai-permission-review.sh

set -euo pipefail

# Read hook input JSON from stdin
HOOK_INPUT=$(cat)

# Debug logging
echo "$(date -u +%Y-%m-%dT%H:%M:%SZ) | Hook triggered with input: $HOOK_INPUT" >> .claude/hook-debug.log

# Extract key information from hook input
# Hook input schema: { event_type, tool_name, tool_input, session_id }
# Note: 'description' may be a top-level field or within tool_input
TOOL_NAME=$(echo "$HOOK_INPUT" | jq -r '.tool_name // empty')
TOOL_INPUT=$(echo "$HOOK_INPUT" | jq -r '.tool_input // {}')
SESSION_ID=$(echo "$HOOK_INPUT" | jq -r '.session_id // "unknown"')
DESCRIPTION=$(echo "$HOOK_INPUT" | jq -r '.description // .tool_input.description // ""')

# Alternative: use environment variables (also provided by Claude Code)
: "${CLAUDE_TOOL_NAME:=$TOOL_NAME}"
: "${CLAUDE_TOOL_INPUT:=$TOOL_INPUT}"

PROJECT_DIR="${CLAUDE_PROJECT_DIR:-$(pwd)}"

# Validate required fields
if [ -z "$TOOL_NAME" ]; then
  echo "Missing tool_name in hook input" >&2
  echo "Hook input was: $HOOK_INPUT" >&2
  exit 1
fi

# Extract target information for logging (file path, command, etc.)
extract_target() {
  case "$TOOL_NAME" in
    Read|Write|Edit)
      echo "$TOOL_INPUT" | jq -r '.file_path // .path // "unknown"' 2>/dev/null || echo "unknown"
      ;;
    Bash)
      echo "$TOOL_INPUT" | jq -r '.command // "unknown"' 2>/dev/null || echo "unknown"
      ;;
    Glob)
      echo "$TOOL_INPUT" | jq -r '.pattern // "unknown"' 2>/dev/null || echo "unknown"
      ;;
    Grep)
      echo "$TOOL_INPUT" | jq -r '.pattern // "unknown"' 2>/dev/null || echo "unknown"
      ;;
    *)
      echo "various"
      ;;
  esac
}
TARGET=$(extract_target)

# Inline fast-path for Read operations - always allow
# if [[ "$TOOL_NAME" == "Read" ]]; then
#   LOG_FILE="$PROJECT_DIR/.claude/permission-audit.log"
#   mkdir -p "$(dirname "$LOG_FILE")"
#   echo "$(date -u +%Y-%m-%dT%H:%M:%SZ) | $SESSION_ID | $TOOL_NAME | allow | low | $TARGET | Auto-approved read operation" >> "$LOG_FILE"
#   echo '{"hookSpecificOutput":{"hookEventName":"PermissionRequest","decision":{"behavior":"allow"}}}'
#   exit 0
# fi

# Check if Read permission is pre-approved to avoid hook recursion
# When spawning the reviewer Claude Code, it will need to read files.
# If Read is pre-approved in settings, the reviewer won't trigger another
# PermissionRequest hook, avoiding infinite recursion.
check_read_pre_approved() {
  local settings_file="$1"

  if [ ! -f "$settings_file" ]; then
    return 1
  fi

  # Check if "Read" or "*" is in permissions.allow list
  jq -e '
    .permissions.allow[]? |
    select(. == "Read" or . == "*")
  ' "$settings_file" >/dev/null 2>&1
}

# Check settings hierarchy (highest priority first)
READ_PRE_APPROVED=false

# 1. Check .claude/settings.local.json (highest priority - overrides)
if [ -f "$PROJECT_DIR/.claude/settings.local.json" ]; then
  if check_read_pre_approved "$PROJECT_DIR/.claude/settings.local.json"; then
    READ_PRE_APPROVED=true
  fi
fi

# 2. Check .claude/settings.json (project level)
if [ "$READ_PRE_APPROVED" = false ] && [ -f "$PROJECT_DIR/.claude/settings.json" ]; then
  if check_read_pre_approved "$PROJECT_DIR/.claude/settings.json"; then
    READ_PRE_APPROVED=true
  fi
fi

# 3. Check ~/.claude/settings.json (user level - lowest priority)
if [ "$READ_PRE_APPROVED" = false ] && [ -f "$HOME/.claude/settings.json" ]; then
  if check_read_pre_approved "$HOME/.claude/settings.json"; then
    READ_PRE_APPROVED=true
  fi
fi

# If Read is not pre-approved, we cannot safely spawn the reviewer
# as it would trigger another PermissionRequest hook and cause recursion.
# Fall back to leaving the permission for the user to approve manually without returning back anything.
if [ "$READ_PRE_APPROVED" = false ]; then
  echo "$(date -u +%Y-%m-%dT%H:%M:%SZ) | AI reviewer unavailable (READ not pre-approved in permissions.allow) - manual review required" >> .claude/hook-debug.log
  exit 0
fi

# Create a temporary file for the review prompt
REVIEW_PROMPT_FILE=$(mktemp)
trap "rm -f $REVIEW_PROMPT_FILE" EXIT

# Construct the review prompt
cat > "$REVIEW_PROMPT_FILE" <<EOF
You are a security reviewer for Claude Code operations. Your task is to review whether this tool call should be approved.

## Your Instructions

1. First, review the project's approval guidelines by running: /approve-action
2. Read the project context (CLAUDE.md, README.md, etc.) to understand the project
3. Evaluate the specific tool call against the guidelines
4. Make a decision: allow, deny, or ask

## Tool Call to Review

Tool Name: $TOOL_NAME

Description: $DESCRIPTION

Tool Parameters:
$(echo "$TOOL_INPUT" | jq '.')

## Required Output Format

You MUST respond with ONLY a valid JSON object (no markdown, no code blocks, no explanation):

{
  "decision": "allow" | "deny" | "ask",
  "reason": "Brief explanation for your decision",
  "riskLevel": "low" | "medium" | "high"
}

Decision meanings:
- "allow": Safe operation that aligns with approval guidelines
- "deny": Dangerous operation or violates approval guidelines
- "ask": Uncertain, requires human review

Base your decision on:
1. The approval guidelines from /approve-action
2. Security and safety considerations
3. Risk vs benefit analysis

Respond with ONLY the JSON object, nothing else.
EOF

# Call Claude Code in non-interactive mode
# Read permission is pre-approved, so the reviewer can read files (CLAUDE.md, project files)
# without triggering another PermissionRequest hook (avoiding recursion)
echo "$(date -u +%Y-%m-%dT%H:%M:%SZ) | About to call claude reviewer" >> .claude/hook-debug.log
AI_REVIEW_OUTPUT=$(timeout 120 claude -p "$(cat $REVIEW_PROMPT_FILE)" 2>&1 || echo "TIMEOUT_OR_ERROR")
echo "$(date -u +%Y-%m-%dT%H:%M:%SZ) | Claude reviewer returned: $AI_REVIEW_OUTPUT" >> .claude/hook-debug.log

# Extract JSON decision from Claude's response
# Claude may wrap the JSON in markdown code blocks or other text
AI_DECISION=$(echo "$AI_REVIEW_OUTPUT" | grep -o '{[^}]*"decision"[^}]*}' | head -1 || echo "")
echo "$(date -u +%Y-%m-%dT%H:%M:%SZ) | AI_DECISION (first attempt): $AI_DECISION" >> .claude/hook-debug.log

# Fallback: try to find any JSON object (including multi-line)
if [ -z "$AI_DECISION" ]; then
  AI_DECISION=$(echo "$AI_REVIEW_OUTPUT" | tr '\n' ' ' | grep -o '{[^}]*"decision"[^}]*}' | head -1 || echo "")
  echo "$(date -u +%Y-%m-%dT%H:%M:%SZ) | AI_DECISION (multiline attempt): $AI_DECISION" >> .claude/hook-debug.log
fi

# Final fallback: find any JSON object
if [ -z "$AI_DECISION" ]; then
  AI_DECISION=$(echo "$AI_REVIEW_OUTPUT" | tr '\n' ' ' | grep -o '{.*}' | head -1 || echo "")
  echo "$(date -u +%Y-%m-%dT%H:%M:%SZ) | AI_DECISION (final fallback): $AI_DECISION" >> .claude/hook-debug.log
fi

# Validate we got a proper decision
if [ -z "$AI_DECISION" ] || ! echo "$AI_DECISION" | jq -e . >/dev/null 2>&1; then
  echo "AI review failed to produce valid JSON" >&2
  echo "Response was: $AI_REVIEW_OUTPUT" >&2
  # Default to "ask" on failure
  DECISION="ask"
  REASON="AI review failed - requires human review"
  RISK_LEVEL="medium"
else
  # Extract decision fields
  DECISION=$(echo "$AI_DECISION" | jq -r '.decision // "ask"')
  REASON=$(echo "$AI_DECISION" | jq -r '.reason // "AI review completed"')
  RISK_LEVEL=$(echo "$AI_DECISION" | jq -r '.riskLevel // "medium"')
fi

# Log the decision for audit trail
LOG_FILE="$PROJECT_DIR/.claude/permission-audit.log"
mkdir -p "$(dirname "$LOG_FILE")"
echo "$(date -u +%Y-%m-%dT%H:%M:%SZ) | $SESSION_ID | $TOOL_NAME | $DECISION | $RISK_LEVEL | $TARGET | $REASON" >> "$LOG_FILE"

# Return the decision to Claude Code
# Output format with proper hook response structure
case "$DECISION" in
  allow)
    echo '{"hookSpecificOutput":{"hookEventName":"PermissionRequest","decision":{"behavior":"allow"}}}'
    exit 0
    ;;
  deny)
    # For "deny", we don't return a hook decision, leave it for user to review 
    echo "$(date -u +%Y-%m-%dT%H:%M:%SZ) | AI reviewer returned 'deny' - manual review required" >> .claude/hook-debug.log
    exit 0
    ;;
  ask)
    # For "ask", we don't return a hook decision, leave it for user to review 
    echo "$(date -u +%Y-%m-%dT%H:%M:%SZ) | AI reviewer returned 'ask' - manual review required" >> .claude/hook-debug.log
    exit 0
    ;;
  *)
    echo "Invalid AI decision: $DECISION" >&2
    exit 1
    ;;
esac
