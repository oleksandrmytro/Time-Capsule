# MongoDB Security Setup

## Environment Variables

This project uses environment variables to store sensitive information like passwords. 

### Setup Instructions

1. Copy the example environment file:
   ```bash
   cp .env.example .env
   ```

2. Edit the `.env` file and replace `your-secure-password-here` with a strong password.

3. **NEVER commit the `.env` file to git!** It's already in `.gitignore`.

### Password Requirements

- Minimum 16 characters
- Include uppercase and lowercase letters
- Include numbers and special characters
- Avoid common words or patterns

### Example Strong Password

```
TimeCapsule2025!MongoDB$Secure#Pass
```

## SSL/TLS Security

The MongoDB cluster uses TLS encryption with self-signed certificates located in the `ssl/` directory.

## Connection String

For MongoDB Compass or other clients, use:
```
mongodb://time-capsule-admin:YOUR_PASSWORD@mongo.distrbyt.dev:27017/time-capsule?authSource=admin&ssl=true&tlsAllowInvalidCertificates=true
```

Replace `YOUR_PASSWORD` with the password from your `.env` file.
