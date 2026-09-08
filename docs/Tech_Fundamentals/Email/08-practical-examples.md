# Practical Examples and Code

## Sending Email with Node.js (Nodemailer)

### Basic Example
```javascript
const nodemailer = require('nodemailer');

// Create transporter
const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 587,
  secure: false, // true for 465, false for other ports
  auth: {
    user: 'your-email@gmail.com',
    pass: 'your-app-password'
  }
});

// Send email
const mailOptions = {
  from: 'sender@example.com',
  to: 'recipient@example.com',
  subject: 'Test Email',
  text: 'Plain text content',
  html: '<b>HTML content</b>'
};

transporter.sendMail(mailOptions, (error, info) => {
  if (error) {
    console.log(error);
  } else {
    console.log('Email sent: ' + info.response);
  }
});
```

### With Attachments
```javascript
const mailOptions = {
  from: 'sender@example.com',
  to: 'recipient@example.com',
  subject: 'Email with attachment',
  text: 'Please see attached file',
  attachments: [
    {
      filename: 'document.pdf',
      path: '/path/to/document.pdf'
    },
    {
      filename: 'image.png',
      content: Buffer.from('base64string', 'base64')
    }
  ]
};
```

### With Read Receipt
```javascript
const mailOptions = {
  from: 'sender@example.com',
  to: 'recipient@example.com',
  subject: 'Important Email',
  text: 'Please confirm receipt',
  headers: {
    'Disposition-Notification-To': 'sender@example.com',
    'Return-Receipt-To': 'sender@example.com'
  }
};
```

## Python Email (smtplib)

### Send Email
```python
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

# Create message
msg = MIMEMultipart()
msg['From'] = 'sender@example.com'
msg['To'] = 'recipient@example.com'
msg['Subject'] = 'Test Email'

# Body
body = 'This is the email body'
msg.attach(MIMEText(body, 'plain'))

# Send
server = smtplib.SMTP('smtp.gmail.com', 587)
server.starttls()
server.login('your-email@gmail.com', 'your-password')
text = msg.as_string()
server.sendmail('sender@example.com', 'recipient@example.com', text)
server.quit()
```

### With Attachment
```python
from email.mime.base import MIMEBase
from email import encoders

# Attach file
filename = 'document.pdf'
attachment = open('/path/to/document.pdf', 'rb')

part = MIMEBase('application', 'octet-stream')
part.set_payload(attachment.read())
encoders.encode_base64(part)
part.add_header('Content-Disposition', f'attachment; filename= {filename}')

msg.attach(part)
```

## Reading Email (IMAP)

### Python Example
```python
import imaplib
import email

# Connect
mail = imaplib.IMAP4_SSL('imap.gmail.com')
mail.login('your-email@gmail.com', 'your-password')
mail.select('inbox')

# Search for emails
status, messages = mail.search(None, 'UNSEEN')

# Fetch email
for num in messages[0].split():
    status, data = mail.fetch(num, '(RFC822)')
    email_msg = email.message_from_bytes(data[0][1])

    print('From:', email_msg['From'])
    print('Subject:', email_msg['Subject'])

    # Get body
    if email_msg.is_multipart():
        for part in email_msg.walk():
            if part.get_content_type() == 'text/plain':
                print('Body:', part.get_payload(decode=True))
    else:
        print('Body:', email_msg.get_payload(decode=True))

mail.close()
mail.logout()
```

## Testing SMTP Connection

### Using telnet
```bash
telnet smtp.example.com 25

EHLO example.com
MAIL FROM:<sender@example.com>
RCPT TO:<recipient@example.com>
DATA
Subject: Test Email

This is a test email.
.
QUIT
```

### Check MX Records
```bash
nslookup -type=MX gmail.com
dig MX gmail.com
host -t MX gmail.com
```

### Verify SPF Record
```bash
nslookup -type=TXT example.com
dig TXT example.com
```

## Email Validation

### Basic Regex (JavaScript)
```javascript
function validateEmail(email) {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email);
}
```

### More Robust Validation
```javascript
function validateEmail(email) {
  // RFC 5322 compliant (simplified)
  const re = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
  return re.test(email);
}
```

## Troubleshooting Common Issues

### 1. Authentication Failed
- Check username/password
- Enable "less secure apps" or use app passwords
- Verify 2FA settings

### 2. Connection Timeout
- Check firewall/network settings
- Verify correct port (25, 587, 465)
- Try different SMTP server

### 3. Email Goes to Spam
- Set up SPF, DKIM, DMARC
- Check email content for spam triggers
- Verify sender reputation
- Include unsubscribe link

### 4. Bounce Messages
- Verify recipient email address
- Check mailbox not full
- Review error codes in bounce message
