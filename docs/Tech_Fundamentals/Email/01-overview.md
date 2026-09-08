# Email System Overview

## What is Email?
Electronic mail (email) is a method of exchanging messages between people using electronic devices.

## High-Level Architecture

```
[Sender] → [Mail Client] → [SMTP Server] → [Internet] → [Recipient SMTP Server] → [Mail Client] → [Recipient]
```

## Key Questions to Explore
- How does an email travel from sender to recipient?
- What protocols are involved?
- How is email stored and retrieved?
- How do email receipts work?
- What security mechanisms exist?
- How are attachments handled?

## Topics to Cover
1. Email Protocols (SMTP, POP3, IMAP)
2. Email Headers and Structure
3. DNS and MX Records
4. Email Delivery and Routing
5. Read Receipts and Delivery Confirmations
6. Authentication (SPF, DKIM, DMARC)
7. Attachments and MIME
8. Email Clients vs Web Mail
9. Spam Filtering
10. Email Security and Encryption
