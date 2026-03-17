# ECHO Skills Directory

Place `.md` skill files in this directory. The backend will scan them when
the frontend clicks "Scan Local Skills" (folder icon in the Skills panel).

## Skill file format

Each file should be a markdown document. The skill name is extracted from
the first `# Heading` line, or from the filename if no heading is found.

### Example: `code-review.md`

```markdown
# Code Review Expert

You are an expert code reviewer. When reviewing code:
1. Check for security vulnerabilities
2. Evaluate performance implications
3. Suggest cleaner patterns
```

Files named `README.md` are ignored during scanning.
