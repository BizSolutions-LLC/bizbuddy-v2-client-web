# Server request: BB-145 public contact form

**From:** client (bizbuddy-v2-client-web)
**For:** bizbuddy-v2-server
**Status:** Accepted by the server, 2026-11-23 (built, not deployed). One change from the server: the client also sends `elapsedMs` (ms since the form appeared, measured in the browser), which the server prefers over `startedAt`. The client sends both. Email type in the Emails log: `CONTACT_FORM`.
**Database change:** none expected (the email goes through the existing mailer and shows in the System Admin Emails log, BB-140).

## Why

The landing page redesign (BB-145) has a contact form: Name, Work email, Company, Team size, Message. Today "Send message" only opens the visitor's email app, which loses leads when they use webmail. Carlo wants the form to actually send, **simple, professional and secure**.

**Decisions (Carlo, 2026-11-23):**
- The server emails the message to the company inbox. The visitor's address is the **Reply-To**, so the team just hits Reply.
- **No auto-reply to the visitor.** The address isn't verified, so an auto-reply would let anyone make our server email a stranger. The page shows a confirmation instead.
- No new database table. The Emails log is the record.

---

## `POST /api/public/contact`

**Public, no auth.** Mount it before the auth middleware.

### Request

```json
{
  "name": "Jane Doe",
  "email": "jane@company.com",
  "company": "Acme Inc.",
  "teamSize": "25",
  "message": "We'd like a quote for 25 people across two sites.",
  "website": "",
  "startedAt": 1795435200000
}
```

| Field | Rules |
|---|---|
| `name` | Required. Trimmed, 1–100 chars. No line breaks. |
| `email` | Required. Trimmed, valid email, max 254 chars. No line breaks. |
| `phone` | Optional (added by the server, 2026-11-23). Trimmed, max 30 chars, one line. Digits, spaces and `+ ( ) - .`, plus an optional extension (`x12`, `ext. 12`). 7–15 digits. Error: "Enter a valid phone number." |
| `company` | Optional. Trimmed, max 150 chars. No line breaks. |
| `teamSize` | Optional. Trimmed, max 20 chars. Free text: people type "25", "10-50" or "about 30". |
| `message` | Required. Trimmed, 10–5000 chars. Line breaks allowed. |
| `website` | **Honeypot.** A hidden field that people never see. Must be empty. |
| `startedAt` | Milliseconds timestamp from when the form appeared in the browser. Used for the "too fast" check. |

Reject unknown fields, or ignore them. Never pass them along.

### Responses

| Case | Status | Body |
|---|---|---|
| Sent | `202` | `{ "ok": true }` |
| **Looks like a bot**: `website` filled in, or sent less than 3 s after `startedAt` | `202` | `{ "ok": true }`. **Drop it silently.** Don't send it, and don't tell the bot it failed. Logging the drop is fine. |
| Validation failed | `400` | `{ "code": "VALIDATION_ERROR", "message": "Please check the highlighted fields.", "fields": { "email": "Enter a valid email address." } }` |
| Too many messages | `429` + `Retry-After` header | `{ "code": "RATE_LIMITED", "message": "Too many messages. Please try again later." }` |
| Anything else | `500` | `{ "code": "CONTACT_FAILED", "message": "We couldn't send your message. Please email us directly." }` |

Error messages are fixed text. **Never echo the visitor's input back** in an error.

---

## Security

1. **Rate limits**:
   - per IP: **5 per hour** and **20 per day**;
   - overall: **200 per day** for all senders together, so a flood can't use up the mail quota or get the domain flagged as spam.

   Return a `429` with `Retry-After` when a limit is hit.
2. **Small bodies only**: a 16 KB JSON limit on this route.
3. **No email header injection**: reject CR/LF in `name`, `email` and `company`. These end up in the subject or Reply-To.
4. **Escape everything** that goes into the HTML email, or send it as plain text. Never put visitor text into a template unescaped.
5. **Link spam**: a message with **more than 3 URLs** is treated as spam (silent `202`, not sent).
6. **CORS**: allow only the site's own origins (mybizbuddy.co and the preview/dev origins already allowed).
7. **The destination address stays on the server** in config, for example `CONTACT_FORM_TO=info@bizsolutions.us`. The client never sends or chooses a recipient.
8. **Log for abuse review**: IP, time and outcome (sent / dropped / rate-limited). Don't log the message body outside the Emails log.

---

## The email

- **To:** `CONTACT_FORM_TO`
- **Reply-To:** the visitor's `email`
- **Subject:** `Website inquiry: {company or name}`. Cut to 120 chars.
- **Body:** the label/value pairs (Name, Work email, Company, Team size), then the message with its line breaks kept, then a footer: "Sent from the contact form on mybizbuddy.co · {date, time, timezone}".
- It should appear in the System Admin **Emails** page like any other email the server sends, with its own template name, for example `contact-form`.

---

## Client side (already built)

`components/Home/landing/ContactSection.jsx`:
- sends the request above to `${NEXT_PUBLIC_API_URL}/api/public/contact`;
- fills `startedAt` when the form appears, and includes the hidden `website` field;
- shows "Sending…", then a confirmation, or the server's `message`;
- marks fields in error from `fields`;
- on `429`, `5xx` or no response (including a `404` before this ships), shows "We couldn't send your message", with an **email us directly** link that pre-fills the visitor's email app, like today.
