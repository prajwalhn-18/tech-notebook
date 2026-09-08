# Email Delivery and Routing

## Email Delivery Flow

```
1. User sends email via Mail Client
2. Client connects to SMTP server
3. SMTP server looks up recipient's MX records via DNS
4. SMTP server connects to recipient's mail server
5. Recipient's server accepts and stores the email
6. Recipient retrieves email via POP3/IMAP
```

## DNS and MX Records

**MX (Mail Exchange) Records** tell sending servers where to deliver email for a domain.

### Example MX Record Lookup
```bash
nslookup -type=MX example.com
```

Response:
```
example.com    MX preference = 10, mail exchanger = mail1.example.com
example.com    MX preference = 20, mail exchanger = mail2.example.com
```

- Lower preference number = higher priority
- Multiple MX records provide redundancy

## Email Routing Process

1. **DNS Lookup**: Sender's server queries DNS for recipient's MX records
2. **Connection**: Connects to highest priority MX server
3. **Handshake**: SMTP handshake (EHLO)
4. **Transfer**: Sends email using SMTP commands
5. **Acknowledgment**: Receiving server confirms receipt
6. **Storage**: Email stored in recipient's mailbox

## Delivery Status

### Success Codes
- **250**: Requested action completed
- **251**: User not local, will forward

### Failure Codes
- **450**: Mailbox unavailable (temporary)
- **550**: Mailbox unavailable (permanent)
- **552**: Mailbox full
- **554**: Transaction failed

## Email Queuing

If delivery fails:
1. Email placed in queue
2. Retry attempts (typically over 4-5 days)
3. If all attempts fail, bounce message sent to sender
