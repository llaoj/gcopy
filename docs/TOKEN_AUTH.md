# Token-Based Authentication

GCopy supports two authentication modes:

## Email Authentication (Default)

Email authentication provides higher security by requiring email verification.

### Setup

```bash
./gcopy \
  -auth-mode=email \
  -app-key=<your-app-key> \
  -smtp-host=<smtp-host> \
  -smtp-port=<smtp-port> \
  -smtp-username=<smtp-username> \
  -smtp-password=<smtp-password>
```

### How it works

1. User enters email address
2. System sends 6-digit verification code to email
3. User enters code to authenticate
4. Session is valid for 5 minutes

## Token Authentication

Token authentication provides convenience for trusted environments with lower security requirements.

### Setup

```bash
./gcopy \
  -auth-mode=token \
  -app-key=<your-app-key>
```

Note: SMTP configuration is not required for token mode.

### How it works

1. User generates a 6-character token or enters an existing one
2. Token is stored in browser session (cookie)
3. Session is valid for 7 days with sliding expiration
4. Multiple devices can use the same token to share clipboard

### Security Considerations

**⚠️ IMPORTANT SECURITY WARNINGS:**

Token mode is **recommended for**:
- Intranet/LAN environments
- Personal use
- Trusted team environments

**Security risks:**
- Token is only 6 characters - provides basic security level
- Token leakage may lead to data breach
- Leaked token provides 7-day clipboard access
- Cannot be actively revoked (but expires after 7 days of inactivity)

**Best practices:**
- Keep token secure, don't share with unauthorized users
- Don't use in public or untrusted environments
- Regularly check token usage
- Regenerate token immediately if leakage is suspected

### Multi-Device Setup

To share clipboard between devices using token mode:

1. Generate a token on Device A
2. Save the token securely
3. On Device B, select "Enter Token" and input the same token
4. Both devices now share the same clipboard storage

### Sliding Expiration

Token sessions use sliding expiration:
- Initial validity: 7 days
- Each API access automatically extends validity by 7 days
- After 7 days of inactivity, token expires
- User must re-enter token to continue access

## Comparison

| Feature | Email Authentication | Token Authentication |
|---------|---------------------|----------------------|
| Security Level | High | Basic |
| Setup Complexity | Requires SMTP | No SMTP required |
| Multi-device | Re-auth on each device | Single token for all |
| Session Duration | 5 minutes | 7 days (sliding) |
| Revocability | Easy (resend code) | Wait for expiration |
| Recommended For | Public services | Private networks |

## Configuration Reference

### Command Line Flags

- `-auth-mode`: Authentication mode (email|token), default: email
- `-app-key`: Encryption key for sessions (required, min 8 characters)

For email mode, additional flags are required:
- `-smtp-host`: SMTP server host
- `-smtp-port`: SMTP server port (default: 587)
- `-smtp-username`: SMTP username
- `-smtp-password`: SMTP password
- `-smtp-ssl`: Use SSL (default: false, uses STARTTLS)
- `-smtp-sender`: Email sender address (optional, defaults to username)

## Migration

### From Email to Token Mode

1. Stop gcopy service
2. Update configuration to use `-auth-mode=token`
3. Remove SMTP configuration
4. Restart service
5. Users must generate new tokens

Note: Existing email sessions will be invalidated.

### From Token to Email Mode

1. Configure SMTP settings
2. Update configuration to use `-auth-mode=email`
3. Restart service
4. Users must authenticate with email

Note: Existing token sessions will be invalidated.

## Implementation Details

### Token Generation

- 6-character alphanumeric (A-Z, a-z, 0-9)
- Total combinations: 62^6 ≈ 568 billion
- Generated using crypto/rand for security
- Collision probability is extremely low

### Session Storage

Token is stored in browser session using encrypted cookies:
- Cookie name: `user_session`
- Encrypted with app-key (AES+HMAC)
- HttpOnly, Secure flags enabled
- SameSite=Strict for CSRF protection

### API Endpoints

Token mode provides:
- `POST /api/v1/user/token/generate` - Generate new token
- `POST /api/v1/user/token/verify` - Verify existing token

Email mode provides:
- `POST /api/v1/user/email-code` - Send verification code
- `POST /api/v1/user/login` - Verify code

Common endpoints:
- `GET /api/v1/user` - Get current user info
- `GET /api/v1/user/logout` - Logout
- `GET /api/v1/clipboard` - Get clipboard
- `POST /api/v1/clipboard` - Update clipboard
