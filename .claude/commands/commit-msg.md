---
description: Write a commit message following project guidelines
argument-hint: [optional additional context]
allowed-tools: [Bash]
---

You are writing a git commit message following the project's commit message guidelines.

First, check the staged changes:
!git diff --cached --stat
!git diff --cached

If there are no staged changes, tell the user to stage files first with `git add`.

Then analyze the changes and write a commit message following these guidelines:

## Commit Message Format

```
<type>[optional scope]: <short description> [optional issue-no]

- Detailed change point 1
- Detailed change point 2
- Detailed change point 3
...
```

## Commit Message Guidelines

1. **Subject Line**: `<type>[optional scope]: <short description> [optional issue-no]`
   - Keep the description short (50 chars or less preferred)
   - Use imperative mood ("Add" not "Adds" or "Added")
   - Do NOT end with a period

2. **Body - Bullet Points**: Detailed description of changes in point form
   - Each bullet point starts with `- ` (dash and space)
   - Focus on WHAT changed, not HOW
   - Group related changes together
   - Use imperative mood for each bullet

3. **Explain "what" and "why", not "how"**: The code itself shows how. The commit message should explain what the change does and why it was necessary.

4. **Type** (mandatory, lowercase):
   - `feat`: A new feature
   - `fix`: A bug fix
   - `docs`: Documentation only changes
   - `style`: Code style, formatting, and linting changes
   - `refactor`: Code change that neither adds a feature nor fixes a bug
   - `perf`: A code change that improves performance
   - `test`: Adding or correcting tests
   - `chore`: Maintenance tasks or build process changes

5. **Scope** (optional, lowercase in parentheses): The part of the codebase affected

6. **Issue numbers** (optional): e.g., `#100` or `#100 #101`

## Full Example

```
feat(search): Add search and deep_search tools with server-orchestrated iterative research

- Add search tool for quick single-round queries
- Add deep_search tool for multi-round research with verification loops
- Refactor shared utilities from deep-research.ts to utils.ts
- Add prompt templates for search, deep-search, and verification rounds
- Update server.ts to register new tools with Zod schemas
- Add DEEP_SEARCH_MAX_ITERATIONS config option
- Update README.md with tool usage documentation
- Mark OpenSpec tasks as completed
```

## Additional Context

{{ARGUMENTS}}

After generating the commit message, present it in a code block and ask the user if they want to proceed with creating the commit. If yes, create the commit using:
!git commit -m "<your message>"

Remember: Use `!git commit -m "$(cat <<'EOF'
<commit message here>

EOF
)"` to properly format multi-line commit messages.
