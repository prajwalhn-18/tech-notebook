# Email Authentication and Security

## Email Security Challenges
- Email was designed without authentication
- Easy to spoof sender addresses
- Vulnerable to interception
- Phishing and spam problems

## SPF (Sender Policy Framework)

**Purpose**: Verify sender's IP address is authorized to send email for the domain.

### How SPF Works
1. Domain owner publishes SPF record in DNS
2. Receiving server checks if sending IP is in SPF record
3. Email accepted or rejected based on policy

### SPF Record Example
```
v=spf1 ip4:192.0.2.0/24 include:_spf.google.com -all
```

- `v=spf1`: SPF version
- `ip4:192.0.2.0/24`: Authorized IP range
- `include:_spf.google.com`: Include another domain's SPF
- `-all`: Reject if not matched

### SPF Results
- **Pass**: IP is authorized
- **Fail**: IP is not authorized
- **SoftFail**: Probably not authorized
- **Neutral**: No policy
- **None**: No SPF record

## DKIM (DomainKeys Identified Mail)

**Purpose**: Cryptographically verify email hasn't been tampered with.

### How DKIM Works
1. Sending server signs email with private key
2. Public key published in DNS
3. Receiving server verifies signature with public key

### DKIM Signature Header
```
DKIM-Signature: v=1; a=rsa-sha256; d=example.com; s=selector;
  h=from:to:subject; bh=base64hash;
  b=signature
```

### DKIM DNS Record
```
selector._domainkey.example.com TXT "v=DKIM1; k=rsa; p=publickey"
```

## DMARC (Domain-based Message Authentication, Reporting & Conformance)

**Purpose**: Policy framework for SPF and DKIM, with reporting.

### How DMARC Works
1. Combines SPF and DKIM results
2. Applies policy (none, quarantine, reject)
3. Sends reports to domain owner

### DMARC Record Example
```
_dmarc.example.com TXT "v=DMARC1; p=reject; pct=100; rua=mailto:reports@example.com"
```

- `p=reject`: Policy (none/quarantine/reject)
- `pct=100`: Apply to 100% of emails
- `rua`: Aggregate report address
- `ruf`: Forensic report address

## Email Encryption

### 1. TLS (Transport Layer Security)
- Encrypts connection between mail servers
- Protects email in transit
- Opportunistic or enforced

### 2. S/MIME (Secure/MIME)
- End-to-end encryption
- Requires certificates
- Built into most email clients

### 3. PGP/GPG (Pretty Good Privacy)
- End-to-end encryption
- Public/private key pairs
- Requires key exchange

## Security Best Practices

1. **Enable SPF, DKIM, and DMARC** for your domain
2. **Use TLS** for server connections
3. **Verify sender** before clicking links
4. **Be cautious** of unexpected attachments
5. **Enable 2FA** on email accounts
6. **Use strong passwords**
7. **Regular security audits**

## Common Attack Vectors

- **Phishing**: Fake emails to steal credentials
- **Spoofing**: Forging sender address
- **Man-in-the-Middle**: Intercepting unencrypted email
- **Email Bombing**: Overwhelming inbox
- **Malware**: Malicious attachments
