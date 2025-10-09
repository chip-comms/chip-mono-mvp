# Supabase Database Management

This directory contains database schema, migrations, and utilities for the Meeting Intelligence Assistant.

## 📁 Structure

```
supabase/
├── config.toml                    # Supabase project configuration
├── migrations/                    # SQL migration files
│   └── 20250108220300_initial_schema.sql
├── database.types.ts              # Generated TypeScript types
├── functions/                     # Supabase Edge Functions
│   └── process-meeting/
└── README.md                      # This file
```

## 🗄️ Current Schema

The database contains two main tables:

### `processing_jobs`

Tracks video processing jobs and their status.

| Column             | Type        | Description                                        |
| ------------------ | ----------- | -------------------------------------------------- |
| `id`               | uuid        | Unique identifier (primary key)                    |
| `video_url`        | text        | URL or path to the video file                      |
| `status`           | text        | Job status: pending, processing, completed, failed |
| `created_at`       | timestamptz | When the job was created                           |
| `updated_at`       | timestamptz | When the job was last updated                      |
| `processing_error` | text        | Error message if processing failed                 |
| `python_job_id`    | text        | Reference to Python backend job ID                 |

### `meeting_analysis`

Stores AI-generated analysis results from processed meetings.

| Column                  | Type        | Description                                |
| ----------------------- | ----------- | ------------------------------------------ |
| `id`                    | uuid        | Unique identifier (primary key)            |
| `job_id`                | uuid        | Foreign key to processing_jobs             |
| `transcript`            | jsonb       | Full transcript with segments and speakers |
| `summary`               | text        | AI-generated meeting summary               |
| `action_items`          | jsonb       | Extracted action items                     |
| `key_topics`            | jsonb       | Key topics discussed                       |
| `sentiment`             | jsonb       | Sentiment analysis results                 |
| `speaker_stats`         | jsonb       | Statistics for each speaker                |
| `communication_metrics` | jsonb       | Communication metrics and insights         |
| `created_at`            | timestamptz | When the analysis was created              |

## 🚀 Quick Start

Use the database operations script for common tasks:

```bash
# Make script executable
chmod +x ../db-ops.sh

# View all available commands
../db-ops.sh help

# Generate TypeScript types
../db-ops.sh generate-types
```

## 📝 Migration Workflow

### 1. Create a New Migration

```bash
# Create empty migration file
../db-ops.sh migration add_user_preferences

# Edit the generated file
vim migrations/YYYYMMDDHHMMSS_add_user_preferences.sql
```

### 2. Test Locally (Optional)

```bash
# Start local Supabase (requires Docker)
../db-ops.sh start

# Apply migrations locally
../db-ops.sh reset
```

### 3. Apply to Production

```bash
# Push migrations to remote database
../db-ops.sh push
```

### 4. Generate Types

```bash
# Update TypeScript types after schema changes
../db-ops.sh generate-types
```

## 📊 Database Connection

- **Project ID**: `kfikvadshmptpwscgbyu`
- **Region**: East US (North Virginia)
- **Host**: `aws-1-us-east-1.pooler.supabase.com`
- **Database**: `postgres`
- **Username**: `postgres.kfikvadshmptpwscgbyu`

Connection details are available via:

```bash
../db-ops.sh connect
```

## 🔧 TypeScript Integration

Import the generated types in your code:

```typescript
import { Database, Tables } from './supabase/database.types';

// Use table types
type ProcessingJob = Tables<'processing_jobs'>;
type MeetingAnalysis = Tables<'meeting_analysis'>;

// Create Supabase client with types
const supabase = createClient<Database>(url, key);
```

## 📚 Common Operations

### Query Examples

```typescript
// Get all processing jobs
const { data: jobs } = await supabase
  .from('processing_jobs')
  .select('*')
  .order('created_at', { ascending: false });

// Get job with analysis
const { data: jobWithAnalysis } = await supabase
  .from('processing_jobs')
  .select(
    `
    *,
    meeting_analysis (*)
  `
  )
  .eq('id', jobId)
  .single();

// Create new processing job
const { data: newJob } = await supabase
  .from('processing_jobs')
  .insert({
    video_url: 'path/to/video.mp4',
    status: 'pending',
  })
  .select()
  .single();
```

### Status Updates

```typescript
// Update job status
await supabase
  .from('processing_jobs')
  .update({
    status: 'completed',
    updated_at: new Date().toISOString(),
  })
  .eq('id', jobId);

// Save analysis results
await supabase.from('meeting_analysis').insert({
  job_id: jobId,
  transcript: transcriptData,
  summary: aiSummary,
  action_items: actionItems,
  // ... other fields
});
```

## 🛠️ Utilities

### Automated `updated_at`

The `processing_jobs` table has a trigger that automatically updates the `updated_at` column on any UPDATE operation.

### Indexes

Performance indexes are created for:

- `processing_jobs.status`
- `processing_jobs.created_at`
- `meeting_analysis.job_id`
- `meeting_analysis.created_at`

### Foreign Key Constraints

- `meeting_analysis.job_id` references `processing_jobs.id` with `ON DELETE CASCADE`

## 🚨 Important Notes

1. **Migrations are irreversible** - Always test locally first
2. **Backup before major changes** - Use Supabase dashboard to create backups
3. **Type safety** - Regenerate types after schema changes
4. **Docker required** - Local development needs Docker Desktop running

## 📖 Resources

- [Supabase CLI Documentation](https://supabase.com/docs/reference/cli)
- [Database Functions](https://supabase.com/docs/guides/database/functions)
- [Row Level Security](https://supabase.com/docs/guides/auth/row-level-security)
