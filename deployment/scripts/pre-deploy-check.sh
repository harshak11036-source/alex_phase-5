#!/bin/bash
set -e

echo "🔍 Running pre-deployment checks..."

# Check required files exist
REQUIRED_FILES=(
  "firebase.json"
  ".firebaserc"
  "firebase/firestore.rules"
  "firebase/storage.rules"
  "firebase/firestore.indexes.json"
  "apps/web/package.json"
  "functions/package.json"
)

for file in "${REQUIRED_FILES[@]}"; do
  if [ ! -f "$file" ]; then
    echo "❌ Missing required file: $file"
    exit 1
  fi
done
echo "✅ All required files present"

# Check Firebase project is configured
if ! firebase projects:list --json 2>/dev/null | grep -q "projects"; then
  echo "❌ No Firebase projects configured. Run 'firebase login' and 'firebase use <project-id>'"
  exit 1
fi
echo "✅ Firebase project configured"

# Check for uncommitted secrets
if grep -r "sk-\|nvapi-\|AIza\|ya29\." --include="*.ts" --include="*.js" --include="*.json" apps/ functions/ 2>/dev/null | grep -v ".example" | grep -v "node_modules"; then
  echo "⚠️  Warning: Potential API keys found in source code. Please review."
fi

# Check environment variables
if [ ! -f "deployment/environment/.env.example" ]; then
  echo "❌ Missing deployment/environment/.env.example"
  exit 1
fi
echo "✅ Environment example file exists"

# Validate firebase.json syntax
if ! node -e "JSON.parse(require('fs').readFileSync('firebase.json', 'utf8'))" 2>/dev/null; then
  echo "❌ Invalid firebase.json syntax"
  exit 1
fi
echo "✅ firebase.json syntax valid"

# Validate firestore.rules syntax (basic check)
if ! head -1 firebase/firestore.rules | grep -q "rules_version = '2'"; then
  echo "❌ firestore.rules missing rules_version declaration"
  exit 1
fi
echo "✅ firestore.rules syntax appears valid"

# Validate storage.rules syntax (basic check)
if ! head -1 firebase/storage.rules | grep -q "rules_version = '2'"; then
  echo "❌ storage.rules missing rules_version declaration"
  exit 1
fi
echo "✅ storage.rules syntax appears valid"

# Check if build succeeds
echo "🔨 Testing build..."
./deployment/scripts/build.sh > /tmp/build.log 2>&1
if [ $? -ne 0 ]; then
  echo "❌ Build failed. Check /tmp/build.log for details"
  exit 1
fi
echo "✅ Build successful"

echo "🎉 All pre-deployment checks passed!"