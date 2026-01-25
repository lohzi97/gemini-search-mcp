---
agent: build
description: Review an OpenSpec change proposal against the codebase and clarify requirements with the user before implementation.
---
The user has requested to verify the following change proposal. Find the change proposal and follow the instructions below. If you're not sure or if ambiguous, ask for clarification from the user.
<UserRequest>
  $ARGUMENTS
</UserRequest>
<!-- OPENSPEC:START -->
**Guardrails**
- This is a review and clarification phase - do NOT write any implementation code.
- Focus on understanding requirements, identifying gaps, and ensuring the proposal aligns with the codebase.
- Refer to `openspec/AGENTS.md` (located inside the `openspec/` directory—run `ls openspec` or `openspec update` if you don't see it) if you need additional OpenSpec conventions or clarifications.
- Identify any vague or ambiguous details and ask the necessary follow-up questions.

**Steps**
Track these steps as TODOs and complete them one by one.
1. Read the proposal files at `openspec/changes/<change-id>/proposal.md`, `tasks.md`, and any spec deltas to understand the requirements.
2. Examine the relevant codebase files mentioned in the proposal to understand the current implementation (use Glob, Grep, and Read tools).
3. Provide a summary analysis of the proposal including:
   - What the proposal aims to change
   - Current state of the codebase
   - How the proposal would modify the codebase
   - Any potential issues or concerns
4. Ask clarifying questions using the AskUserQuestion tool for any:
   - Ambiguous requirements
   - Unclear implementation details
   - Architectural decisions that need user input
   - Config defaults or behavior options
5. Discuss the proposal with the user and refine requirements based on their feedback.
6. Update the OpenSpec change proposal files (proposal.md, spec deltas, tasks.md) according to the clarified user requirements.
7. Confirm the proposal is ready for implementation or identify remaining issues.

**Reference**
- Use `openspec show <id>` to inspect proposal details.
- Use `openspec validate <id> --strict` to check for validation issues.
- Search the codebase with `rg <keyword>`, `Glob`, and `Read` to understand current implementation.
<!-- OPENSPEC:END -->
