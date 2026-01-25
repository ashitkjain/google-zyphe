# Firestore Index Required for Action Required Widget

## Issue
The Action Required widget queries the `reactivation_messages` collection with multiple filters and an orderBy clause. This requires a composite index in Firestore.

## Required Index

**Collection:** `reactivation_messages`

**Fields to index:**
1. `realtorId` (Ascending)
2. `isInbound` (Ascending)
3. `requires_action` (Ascending)
4. `sent_at` (Descending)

## How to Create the Index

### Option 1: Click the Link in Console Error
When you run the app and check the browser console, Firestore will show an error with a direct link to create the index. Click that link.

### Option 2: Manual Creation in Firebase Console
1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project
3. Navigate to **Firestore Database** → **Indexes** tab
4. Click **Create Index**
5. Select collection: `reactivation_messages`
6. Add fields in this order:
   - `realtorId` - Ascending
   - `isInbound` - Ascending  
   - `requires_action` - Ascending
   - `sent_at` - Descending
7. Click **Create**
8. Wait 2-5 minutes for index to build

### Option 3: Use firestore.indexes.json (Recommended)
Create or update `firestore.indexes.json` in your project root:

```json
{
  "indexes": [
    {
      "collectionGroup": "reactivation_messages",
      "queryScope": "COLLECTION",
      "fields": [
        {
          "fieldPath": "realtorId",
          "order": "ASCENDING"
        },
        {
          "fieldPath": "isInbound",
          "order": "ASCENDING"
        },
        {
          "fieldPath": "requires_action",
          "order": "ASCENDING"
        },
        {
          "fieldPath": "sent_at",
          "order": "DESCENDING"
        }
      ]
    }
  ]
}
```

Then deploy:
```bash
firebase deploy --only firestore:indexes
```

## Debugging

Check browser console for logs:
- 🔍 Building query with filters
- 📡 Executing Firestore query
- 📊 Query returned X documents
- 📦 Mapped results

If you see an error about missing index, follow the link in the error message.

## After Index is Created

1. Refresh the page
2. The Action Required widget should populate with messages
3. Console should show: "📊 Query returned X documents" where X > 0
