# Email Capabilities and Features

## Core Capabilities

### 1. Message Composition
- Plain text
- Rich text (HTML)
- Formatting (bold, italic, lists)
- Inline images
- Signatures

### 2. Attachments
- Multiple file types
- Size limits (typically 25MB)
- MIME encoding for binary files
- Virus scanning

### 3. Recipients
- To (primary recipients)
- Cc (carbon copy - visible to all)
- Bcc (blind carbon copy - hidden)
- Multiple recipients per field

### 4. Organization
- Folders/Labels
- Archive
- Search
- Filters/Rules
- Tags/Categories

### 5. Threading
- Conversation view
- In-Reply-To header
- References header
- Subject line threading

## Advanced Features

### 1. Filtering and Rules
Automatically:
- Move emails to folders
- Apply labels
- Forward messages
- Delete/archive
- Mark as read

Example rule:
```
IF From contains "boss@company.com"
THEN Mark as important AND Forward to mobile
```

### 2. Vacation/Auto-Reply
- Automatic responses when away
- Custom messages
- Date ranges
- Send once per sender option

### 3. Email Forwarding
- Manual forwarding
- Automatic forwarding rules
- Forward as attachment
- Inline forwarding

### 4. Email Aliases
- Multiple addresses for one mailbox
- Plus addressing (user+tag@example.com)
- Catch-all addresses

### 5. Scheduled Sending
- Compose now, send later
- Timezone considerations
- Cancel before sending

### 6. Snooze/Reminders
- Temporarily hide email
- Resurface at specified time
- Reminder notifications

### 7. Undo Send
- Brief window to cancel sent email
- Typically 5-30 seconds
- Actually delays sending

## Modern Email Features

### 1. Smart Compose/Reply
- AI-powered suggestions
- Predictive text
- Context-aware responses

### 2. Priority Inbox
- Automatic importance detection
- Machine learning categorization
- Important/Unread/Everything

### 3. Unsubscribe
- One-click unsubscribe
- List-Unsubscribe header
```
List-Unsubscribe: <mailto:unsubscribe@example.com>, <https://example.com/unsubscribe>
```

### 4. Spam Filtering
- Bayesian filters
- Machine learning
- Reputation systems
- Content analysis
- User feedback

### 5. Email Tracking
- Read receipts
- Link clicks
- Attachment downloads
- Location tracking

### 6. Integration Capabilities
- Calendar invites (.ics files)
- Contact cards (vCard)
- Task creation
- CRM integration
- Cloud storage links

### 7. Mobile Features
- Push notifications
- Offline access
- Swipe gestures
- Voice input
- Biometric authentication

## Email Client Types

### 1. Desktop Clients
- Microsoft Outlook
- Apple Mail
- Thunderbird
- Mailbird

### 2. Webmail
- Gmail
- Outlook.com
- Yahoo Mail
- ProtonMail

### 3. Mobile Apps
- Native email apps
- Third-party clients
- Unified inboxes

## API and Programmatic Access

### Gmail API
```javascript
// Fetch messages
gmail.users.messages.list({
  userId: 'me',
  q: 'is:unread'
})
```

### Microsoft Graph API
```javascript
// Send email
await client.api('/me/sendMail')
  .post({
    message: {
      subject: 'Hello',
      body: { content: 'Message' },
      toRecipients: [{ emailAddress: { address: 'user@example.com' }}]
    }
  });
```

## Limitations and Constraints

1. **Size Limits**
   - Attachment size: 25-50MB typically
   - Message size: Including all parts
   - Recipient limits: Varies by provider

2. **Rate Limits**
   - Sending limits (e.g., 500/day for Gmail)
   - API quotas
   - Connection limits

3. **Format Support**
   - HTML capabilities vary
   - CSS support limited
   - JavaScript blocked for security

4. **Deliverability**
   - Spam filters
   - Reputation systems
   - Authentication requirements
