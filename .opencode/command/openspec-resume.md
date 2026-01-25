---
agent: build
description: Review an in-progress OpenSpec change implementation, verify completion status, fix issues, and continue applying remaining tasks.
---
The user has requested to resume the following change proposal. Find the change proposal and follow the instructions below. If you're not sure or if ambiguous, ask for clarification from the user.
<UserRequest>
  $ARGUMENTS
</UserRequest>
<!-- OPENSPEC:START -->
**Guardrails**
- This command is for continuing an implementation that has already been started or reviewing a completed implementation.
- Only write code to fix identified issues or complete remaining tasks—avoid over-engineering or adding features not specified.
- Keep changes tightly scoped to the requested outcome in the proposal.
- Refer to `openspec/AGENTS.md` (located inside the `openspec/` directory—run `ls openspec` or `openspec update` if you don't see it) if you need additional OpenSpec conventions or clarifications.

**Steps**
Track these steps as TODOs and complete them one by one.

1. **Read the proposal files** to understand the requirements:
   - Read `openspec/changes/<change-id>/specs/**/*.md` to understand the spec deltas
   - Read `openspec/changes/<change-id>/design.md` (if present) for implementation details
   - Read `openspec/changes/<change-id>/tasks.md` to see the task checklist

2. **Examine the codebase** to verify current implementation status:
   - Use Glob and Grep to find files mentioned in the proposal/tasks
   - Read the relevant files to understand what has been implemented
   - Check git status to see modified/untracked files

3. **Analyze implementation status** and provide a summary:
   - What has been done correctly
   - What is incomplete or missing
   - What has been done but has issues (bugs, wrong API usage, etc.)
   - What has been done but can be improved
   - Any deviation from the spec or design

4. **Run validation checks** to identify issues:
   - Detect the project type (Flutter/Python/Node.js/Go/etc.) and run appropriate static analysis:
     - Flutter: `flutter analyze`
     - Python: `ruff check`, `mypy`, or `pylint`
     - Node.js/TypeScript: `eslint`, `tsc --noEmit`
     - Go: `go vet`, `golangci-lint run`
     - Or any other linter configured in the project
   - Run `openspec validate <change-id> --strict` to confirm spec compliance
   - Report any issues found

5. **Fix identified issues**:
   - Fix any code errors, warnings, or bugs found
   - Complete any missing implementation
   - Improve any suboptimal code (if warranted)

6. **Validate fixes**:
   - Re-run the appropriate static analysis command to confirm no new issues
   - Re-run `openspec validate <change-id> --strict` to confirm compliance

7. **Update tasks.md**:
   - Mark completed tasks as `- [x]`
   - Mark tasks that still need work as `- [ ]`
   - Add notes for any tasks requiring manual testing or documentation

8. **Provide final summary** with:
   - What was fixed or completed in this session
   - Remaining tasks that require manual action (testing, documentation, etc.)

**Reference**
- Use `openspec show <id> --json --deltas-only` if you need additional context from the proposal.
- Use `git status` to see modified files in the working directory.
- Search the codebase with `Grep` and `Glob` tools to find relevant files.
<!-- OPENSPEC:END -->
