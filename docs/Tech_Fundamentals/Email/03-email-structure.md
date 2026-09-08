# Email Structure and Headers

## Email Format (RFC 5322)

An email consists of:
1. **Headers** - Metadata about the email
2. **Blank Line** - Separator
3. **Body** - The actual message content

## Common Email Headers

```
From: sender@example.com
To: recipient@example.com
Subject: Email Subject
Date: Mon, 7 Sep 2026 10:30:00 +0000
Message-ID: <unique-id@example.com>
Content-Type: text/plain; charset="UTF-8"
MIME-Version: 1.0
```

### Important Headers

- **From**: Sender's email address
- **To**: Primary recipient(s)
- **Cc**: Carbon copy recipients
- **Bcc**: Blind carbon copy (hidden recipients)
- **Subject**: Email subject line
- **Date**: When email was sent
- **Message-ID**: Unique identifier for the email
- **Reply-To**: Where replies should go
- **Return-Path**: Where bounces should go
- **Received**: Server trail (added by each server)

## MIME (Multipurpose Internet Mail Extensions)

MIME allows emails to include:
- Multiple content types (text, HTML)
- Attachments
- Non-ASCII characters

### MIME Headers
```
MIME-Version: 1.0
Content-Type: multipart/mixed; boundary="boundary-string"
```

### Example Multi-part Email
```
--boundary-string
Content-Type: text/plain

This is the plain text version.

--boundary-string
Content-Type: text/html

<html><body>This is the HTML version.</body></html>

--boundary-string
Content-Type: application/pdf; name="document.pdf"
Content-Disposition: attachment

[Binary data here]
--boundary-string--
```
