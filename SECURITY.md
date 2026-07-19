# Security

## Reporting a vulnerability

If you believe you've found a security vulnerability, please report it responsibly:

1. **Do not** open a public issue.
2. Open a **private security advisory** on GitHub: go to the repo → Security → Advisories → "Report a vulnerability", or email the maintainer if you have that contact.
3. Include steps to reproduce and impact. We'll respond as soon as we can.

## Safe usage

- **Do not commit** `vault-maintenance.config.json` (or any config file) if it contains:
  - Your real vault path (can reveal directory layout)
  - API keys or secrets
- Use a **local config** (e.g. `vault-maintenance.config.local.json`) or **environment variables** for `ANTHROPIC_API_KEY` and keep that file out of version control (add it to `.gitignore` if needed).
- The CLI only **reads** your vault and **writes** the report file; it does not modify your notes. Reports are written under the path you set in `reportFolder`.
