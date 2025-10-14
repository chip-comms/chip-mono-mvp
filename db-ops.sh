#!/bin/bash
# Database Operations Script for Supabase

set -e

PROJECT_ID="kfikvadshmptpwscgbyu"

echo "🗄️  Supabase Database Operations"
echo "================================"
echo "Project: chip ($PROJECT_ID)"
echo ""

case "${1:-help}" in
  "pull")
    echo "⬇️  Pulling current schema from remote database..."
    echo "Note: Docker Desktop must be running for this command"
    cd supabase && supabase db pull --db-url "postgresql://postgres:zhv%21YWC8zuq%40qkj3vru@db.kfikvadshmptpwscgbyu.supabase.co:5432/postgres"
    echo "✅ Schema pulled successfully!"
    echo "Check supabase/migrations/ for the generated files."
    ;;

  "diff")
    if [ -z "$2" ]; then
      echo "❌ Please provide a migration name"
      echo "Usage: ./db-ops.sh diff your_migration_name"
      exit 1
    fi
    echo "📝 Creating migration diff: $2"
    cd supabase && supabase db diff --file "$2"
    echo "✅ Migration file created in supabase/migrations/"
    ;;

  "push")
    echo "⬆️  Pushing migrations to remote database..."
    cd supabase && supabase db push --db-url "postgresql://postgres:zhv%21YWC8zuq%40qkj3vru@db.kfikvadshmptpwscgbyu.supabase.co:5432/postgres"
    echo "✅ Migrations pushed successfully!"
    ;;
    
  "reset")
    echo "⚠️  This will reset your local database and apply all migrations"
    read -p "Are you sure? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
      cd supabase && supabase db reset
      echo "✅ Database reset complete!"
    else
      echo "Cancelled."
    fi
    ;;

  "status")
    echo "📊 Checking database status..."
    cd supabase && supabase status
    ;;

  "start")
    echo "🚀 Starting local Supabase services..."
    cd supabase && supabase start
    echo "✅ Local services started!"
    echo "Studio: http://localhost:54323"
    ;;

  "stop")
    echo "🛑 Stopping local Supabase services..."
    cd supabase && supabase stop
    echo "✅ Local services stopped!"
    ;;

  "generate-types")
    echo "🏗️  Generating TypeScript types..."
    supabase gen types typescript --project-id=$PROJECT_ID > supabase/database.types.ts
    echo "✅ Types generated in supabase/database.types.ts"
    ;;

  "connect")
    echo "🔗 Database connection info:"
    echo "Project ID: $PROJECT_ID"
    echo "Host: aws-1-us-east-1.pooler.supabase.com"
    echo "Database: postgres"
    echo "Username: postgres.$PROJECT_ID"
    echo "Password: zhv!YWC8zuq@qkj3vru"
    echo ""
    echo "Connection string:"
    echo "postgresql://postgres.$PROJECT_ID:zhv%21YWC8zuq%40qkj3vru@aws-1-us-east-1.pooler.supabase.com:5432/postgres"
    ;;

  "migration")
    if [ -z "$2" ]; then
      echo "❌ Please provide a migration name"
      echo "Usage: ./db-ops.sh migration add_users_table"
      exit 1
    fi
    TIMESTAMP=$(date +%Y%m%d%H%M%S)
    FILENAME="$TIMESTAMP_$2.sql"
    touch "supabase/migrations/$FILENAME"
    echo "📝 Created new migration file: supabase/migrations/$FILENAME"
    echo ""
    echo "Add your SQL changes to this file, then run:"
    echo "./db-ops.sh push"
    ;;
    
  "help"|*)
    echo "Available commands:"
    echo ""
    echo "📥 Schema Operations:"
    echo "  pull          - Download current schema from remote"
    echo "  diff          - Create migration from local changes"
    echo "  push          - Apply migrations to remote database"
    echo "  migration     - Create new empty migration file"
    echo ""
    echo "🔧 Local Development:"
    echo "  start         - Start local Supabase services"
    echo "  stop          - Stop local Supabase services"
    echo "  reset         - Reset local database"
    echo "  status        - Check service status"
    echo ""
    echo "🛠️  Utilities:"
    echo "  generate-types - Generate TypeScript types"
    echo "  connect       - Show connection information"
    echo ""
    echo "Examples:"
    echo "  ./db-ops.sh pull"
    echo "  ./db-ops.sh migration add_user_preferences"
    echo "  ./db-ops.sh diff add_user_preferences"
    echo "  ./db-ops.sh push"
    echo "  ./db-ops.sh generate-types"
    ;;
esac