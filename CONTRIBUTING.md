# Contributing

Thanks for your interest in vault-maintenance.

- **Setup:** See the [README](README.md) (Install, Scripts). Run `npm install && npm run test` to confirm tests pass.
- **Code:** Lint with `npm run lint`, format with `npm run format`. Keep the existing structure: pipeline in `run-pipeline.ts`, providers in `ai-providers/`, etc. See [CLAUDE.md](CLAUDE.md) for architecture.
- **PRs:** Open a pull request. CI will run lint, format check, and tests. Please keep the test suite green and add tests for new behavior when relevant.

If you’re the repo owner and this is your first time publishing: replace `USERNAME` in `package.json` and in the README (clone URL and badge URLs) with your GitHub username or org.
