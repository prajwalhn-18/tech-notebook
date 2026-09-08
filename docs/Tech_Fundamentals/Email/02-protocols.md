# Email Protocols

## SMTP (Simple Mail Transfer Protocol)
- **Purpose**: Sending email
- **Port**: 25 (default), 587 (submission), 465 (SMTPS)
- **How it works**:
  - Client connects to SMTP server
  - Handshake with EHLO/HELO command
  - MAIL FROM, RCPT TO commands
  - DATA command to send message body
  - QUIT to close connection

### SMTP Commands
```
HELO/EHLO - Identify the client
MAIL FROM - Specify sender
RCPT TO - Specify recipient
DATA - Begin message content
QUIT - Close connection
```

## POP3 (Post Office Protocol v3)
- **Purpose**: Retrieving email
- **Port**: 110 (default), 995 (POP3S)
- **Characteristics**:
  - Downloads emails from server to client
  - Typically deletes from server after download
  - Good for single device access

## IMAP (Internet Message Access Protocol)
- **Purpose**: Accessing and managing email on server
- **Port**: 143 (default), 993 (IMAPS)
- **Characteristics**:
  - Keeps emails on server
  - Supports folders and synchronization
  - Better for multi-device access
  - Can read email without downloading

## Protocol Comparison

| Feature | SMTP | POP3 | IMAP |
|---------|------|------|------|
| Purpose | Send | Receive | Access |
| Storage | N/A | Local | Server |
| Sync | N/A | No | Yes |
| Multi-device | N/A | Poor | Excellent |
