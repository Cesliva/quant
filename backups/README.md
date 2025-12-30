# Firestore Backups

This directory contains JSON backups of your Firestore database that can be committed to Git.

## Usage

### Create a Backup

```bash
npm run backup:firestore
```

This will:
- Export all Firestore data to JSON
- Save it as `firestore-backup-YYYY-MM-DD.json`
- Also create `firestore-backup-latest.json` for easy access

### Restore from Backup

```bash
# Restore from latest backup
npm run restore:firestore

# Restore from specific backup file
npm run restore:firestore backups/firestore-backup-2024-11-26.json
```

## Important Notes

⚠️ **Before Restoring:**
- Restoring will **merge** data with existing Firestore data
- If you want a clean restore, clear Firestore first
- Always backup before restoring if you have important changes

⚠️ **Git Commit:**
- These backup files can be large
- Consider using Git LFS for large backups
- Or commit only the "latest" backup and keep dated ones locally

## Backup Structure

Backups are JSON files with this structure:

```json
{
  "companies": {
    "default": {
      "name": "Company Name",
      "_subcollections": {
        "projects": {
          "project-id": {
            "projectName": "...",
            "_subcollections": { ... }
          }
        }
      }
    }
  }
}
```

## When to Backup

- ✅ Before major feature development
- ✅ After important data changes
- ✅ Before testing risky operations
- ✅ Before production deployment
- ✅ Weekly/monthly scheduled backups






