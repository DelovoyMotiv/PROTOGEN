# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 1.0.x   | :white_check_mark: |
| < 1.0   | :x:                |

## Reporting a Vulnerability

We take security seriously. If you discover a security vulnerability, please follow these steps:

### Do Not

- Open a public GitHub issue
- Disclose the vulnerability publicly
- Exploit the vulnerability

### Do

1. Email security@example.com with:
   - Description of the vulnerability
   - Steps to reproduce
   - Potential impact
   - Suggested fix (if any)

2. Allow up to 48 hours for initial response

3. Work with us to verify and fix the issue

### What to Expect

- Acknowledgment within 48 hours
- Regular updates on progress
- Credit in security advisory (if desired)
- Coordinated disclosure timeline

## Security Measures

### Cryptography

- Ed25519 for digital signatures
- AES-256-GCM for encryption
- PBKDF2 with 100,000 iterations
- SHA-256 for hashing
- Secure random generation

### Network Security

- TLS certificate validation
- Rate limiting (token bucket algorithm)
- WebSocket security
- DDoS protection
- Circuit breaker pattern

### Application Security

- Input sanitization
- SQL injection prevention
- Command injection prevention
- XSS prevention
- Timing-safe comparisons

### Data Security

- Encryption at rest
- Secure key management
- Backup encryption
- Audit logging
- Access control

## Best Practices

### For Operators

- Use strong passwords (32+ characters)
- Rotate secrets regularly
- Enable rate limiting
- Monitor audit logs
- Keep backups encrypted
- Update dependencies regularly

### For Developers

- Never commit secrets
- Use parameterized queries
- Validate all inputs
- Follow principle of least privilege
- Review security guidelines before contributing

## Security Updates

Security updates are released as soon as possible after verification. Subscribe to releases to stay informed.

## Acknowledgments

We appreciate responsible disclosure and will acknowledge security researchers who help improve PROTOGEN-01 security.
