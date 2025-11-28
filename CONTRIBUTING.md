# Contributing to PROTOGEN-01

Thank you for your interest in contributing to PROTOGEN-01.

## Development Setup

### Prerequisites

- Node.js 22 or higher
- Docker and Docker Compose
- Git
- SQLite3 (for database inspection)

### Local Setup

```bash
git clone https://github.com/your-org/protogen-01.git
cd protogen-01
npm install
cp .env.example .env
```

Configure `.env` with development values:

```bash
BASE_RPC_URL=https://mainnet.base.org
VAULT_PASSWORD=development-password
WALLET_ENCRYPTION_KEY=development-key
VITE_OPENROUTER_API_KEY=your-api-key
```

### Running Locally

```bash
npm run dev
```

## Code Standards

### TypeScript

- Use strict mode
- Avoid `any` types
- Document public APIs with JSDoc
- Use meaningful variable names

### Formatting

- Use Prettier for code formatting
- 2 spaces for indentation
- Single quotes for strings
- Trailing commas in objects and arrays

### Naming Conventions

- `camelCase` for variables and functions
- `PascalCase` for classes and interfaces
- `UPPER_SNAKE_CASE` for constants
- Prefix private methods with underscore

## Testing

### Running Tests

```bash
npm test
```

### Writing Tests

- Place tests in `tests/` directory
- Use descriptive test names
- Test both success and failure cases
- Mock external dependencies

### Test Coverage

Aim for:
- 90% coverage for core services
- 100% coverage for cryptographic functions
- 85% coverage for protocol stack

## Pull Request Process

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Run tests and type checking
5. Commit with descriptive messages
6. Push to your fork
7. Open a pull request

### Commit Messages

Format: `type(scope): description`

Types:
- `feat` - New feature
- `fix` - Bug fix
- `docs` - Documentation
- `refactor` - Code refactoring
- `test` - Testing
- `chore` - Maintenance

Example:
```
feat(consensus): add difficulty adjustment algorithm
fix(blockchain): handle RPC timeout errors
docs(readme): update deployment instructions
```

## Code Review

All submissions require review. We look for:

- Code quality and readability
- Test coverage
- Documentation
- Security considerations
- Performance impact

## Security

### Reporting Vulnerabilities

Do not open public issues for security vulnerabilities.

Email: security@example.com

Include:
- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Suggested fix (if any)

### Security Guidelines

- Never commit secrets or private keys
- Use parameterized queries
- Validate all inputs
- Use timing-safe comparisons
- Follow principle of least privilege

## Documentation

### Code Documentation

- Document all public APIs
- Include usage examples
- Explain complex algorithms
- Document security considerations

### User Documentation

- Keep README.md up to date
- Update DEPLOYMENT.md for infrastructure changes
- Document breaking changes in CHANGELOG.md

## Questions

For questions or discussions:
- Open a GitHub issue
- Join our Discord server
- Email: dev@example.com

## License

By contributing, you agree that your contributions will be licensed under the same license as the project.
