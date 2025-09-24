# Client Review Interface - Visual Mockup

## Visual Architecture for Client Script Review

### Magic Link Flow

```
┌──────────────────────────────────────────────────────┐
│  Internal User sends script for review:              │
│                                                       │
│  [Send for Review] → Enter client email              │
│                      → Generate magic link           │
│                      → Email sent to client          │
└──────────────────────────────────────────────────────┘
                            ↓
┌──────────────────────────────────────────────────────┐
│  Client receives email:                              │
│                                                       │
│  Subject: Script Review Request - [Project Name]     │
│                                                       │
│  Hi [Client Name],                                   │
│  Please review the attached script:                  │
│                                                       │
│  [REVIEW SCRIPT] ← Magic link button                 │
│                                                       │
│  This link expires in 30 days.                       │
└──────────────────────────────────────────────────────┘
                            ↓
┌──────────────────────────────────────────────────────┐
│  Client Review Page (No Login Required!)             │
├──────────────────────────────────────────────────────┤
│                                                       │
│  🎬 Script Review                                     │
│  ─────────────────────────────────                   │
│                                                       │
│  Project: [Project Name]                             │
│  Script: [Script Title]                              │
│                                                       │
│  ┌────────────────────────────────────┐             │
│  │                                      │             │
│  │  C1 | Introduction                  │             │
│  │  ─────────────────────────────      │             │
│  │  Welcome to our video about...      │             │
│  │                                      │             │
│  │  C2 | Main Content                  │             │
│  │  ─────────────────────────────      │             │
│  │  Today we'll explore...             │             │
│  │                                      │             │
│  │  C3 | Call to Action                │             │
│  │  ─────────────────────────────      │             │
│  │  Visit our website to learn more    │             │
│  │                                      │             │
│  └────────────────────────────────────┘             │
│                                                       │
│  Comments: ┌──────────────────────────┐             │
│            │                           │             │
│            └──────────────────────────┘             │
│                                                       │
│  [Approve Script] [Request Changes]                  │
│                                                       │
└──────────────────────────────────────────────────────┘
```

### Database Implementation

```sql
-- When internal user clicks "Send for Review"
SELECT generate_review_link(
    script_id,
    'client@company.com',
    'John Smith'
) as magic_link;

-- Returns: https://review.eav.com/review/a7f8d9e2b4c6...

-- Client visits link (no auth required!)
SELECT * FROM script_reviews
WHERE review_token = 'a7f8d9e2b4c6...'
AND expires_at > NOW();

-- Track viewing
UPDATE script_reviews
SET
    first_viewed_at = COALESCE(first_viewed_at, NOW()),
    last_viewed_at = NOW(),
    view_count = view_count + 1
WHERE review_token = $1;
```

### React Component Structure

```tsx
// Separate review app or route
function ClientReviewPage({ token }: { token: string }) {
  // No auth context needed!
  const { data: review } = useReviewByToken(token);

  if (!review) return <InvalidLinkPage />;
  if (review.expired) return <ExpiredLinkPage />;

  return (
    <MinimalLayout> {/* No nav, no tabs, just content */}
      <ScriptReadOnlyView script={review.script}>
        {/* Only show script content, no editing */}
        <ComponentDisplay />
      </ScriptReadOnlyView>

      <ReviewActions>
        <ApproveButton onClick={handleApprove} />
        <RequestChangesButton onClick={handleChanges} />
      </ReviewActions>
    </MinimalLayout>
  );
}
```

### Benefits of This Approach

1. **No Client Accounts**: No user management complexity
2. **Perfect Isolation**: Clients see ONLY their script
3. **Time-Limited**: Links expire after 30 days
4. **Trackable**: Know when/if client viewed
5. **Simple Implementation**: Just a token lookup
6. **No RLS Complexity**: Token = access

### Alternative: Embedded Review Widget

```html
<!-- Client's email contains embedded review -->
<iframe src="https://review.eav.com/embed/TOKEN"
        width="100%"
        height="600"
        frameborder="0">
</iframe>
```

### Security Considerations

```typescript
// Token generation ensures uniqueness
function generateReviewToken(): string {
  return crypto.randomBytes(32).toString('hex');
  // Results in 64-character unguessable token
}

// Rate limiting on token attempts
if (failedAttempts > 5) {
  blockIP(request.ip);
}

// Optional: Add password for sensitive content
if (review.requires_password) {
  showPasswordPrompt();
}
```

---

**Visual Architect Summary**: Client review should be completely separate from the main app. Magic links provide perfect isolation without authentication complexity.