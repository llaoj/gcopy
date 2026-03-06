#!/bin/bash

# GCopy Release Script
# This script helps create GitHub releases with AI-generated release notes

set -e

# Check if gh is authenticated
if ! gh auth status &> /dev/null; then
    echo "❌ Error: You are not logged in to GitHub CLI"
    echo "Please run: gh auth login"
    exit 1
fi

# Get version from argument or use version.txt
if [ -n "$1" ]; then
    VERSION="$1"
else
    VERSION=$(cat version.txt)
fi

# Remove 'v' prefix if present for comparison
VERSION_NUM="${VERSION#v}"

echo "📦 Preparing release for version: $VERSION"

# Get the previous tag
PREV_TAG=$(git tag --sort=-version:refname | grep -A1 "^v$VERSION_NUM$" | tail -1)
if [ "$PREV_TAG" = "v$VERSION_NUM" ] || [ -z "$PREV_TAG" ]; then
    PREV_TAG=$(git tag --sort=-version:refname | sed -n '2p')
fi

echo "📋 Previous version: $PREV_TAG"

# Get commits between versions
if [ -n "$PREV_TAG" ]; then
    COMMITS=$(git log $PREV_TAG..v$VERSION_NUM --oneline --no-merges --pretty=format:"%s" 2>/dev/null || echo "")
else
    COMMITS=$(git log v$VERSION_NUM --oneline --no-merges --pretty=format:"%s" 2>/dev/null || echo "")
fi

if [ -z "$COMMITS" ]; then
    echo "⚠️  No commits found between $PREV_TAG and v$VERSION_NUM"
    exit 1
fi

echo ""
echo "📝 Commits to include in release:"
echo "$COMMITS"
echo ""

# Create temporary file for release notes
RELEASE_NOTES_FILE=$(mktemp)

# Generate release notes
cat > "$RELEASE_NOTES_FILE" << 'HEREDOC'
## What's Changed

HEREDOC

# Categorize commits
FEATURES=$(echo "$COMMITS" | grep -E '^feat' | sed 's/^feat: /- /' || true)
FIXES=$(echo "$COMMITS" | grep -E '^fix' | sed 's/^fix: /- /' || true)
REFACTORS=$(echo "$COMMITS" | grep -E '^refactor' | sed 's/^refactor: /- /' || true)
DOCS=$(echo "$COMMITS" | grep -E '^docs' | sed 's/^docs: /- /' || true)
CHORES=$(echo "$COMMITS" | grep -E '^chore' | sed 's/^chore: /- /' || true)
OTHERS=$(echo "$COMMITS" | grep -vE '^(feat|fix|refactor|docs|chore)' | sed 's/^/ - /' || true)

if [ -n "$FEATURES" ]; then
    echo "### ✨ New Features" >> "$RELEASE_NOTES_FILE"
    echo "$FEATURES" >> "$RELEASE_NOTES_FILE"
    echo "" >> "$RELEASE_NOTES_FILE"
fi

if [ -n "$FIXES" ]; then
    echo "### 🐛 Bug Fixes" >> "$RELEASE_NOTES_FILE"
    echo "$FIXES" >> "$RELEASE_NOTES_FILE"
    echo "" >> "$RELEASE_NOTES_FILE"
fi

if [ -n "$REFACTORS" ]; then
    echo "### ♻️ Code Refactoring" >> "$RELEASE_NOTES_FILE"
    echo "$REFACTORS" >> "$RELEASE_NOTES_FILE"
    echo "" >> "$RELEASE_NOTES_FILE"
fi

if [ -n "$DOCS" ]; then
    echo "### 📝 Documentation" >> "$RELEASE_NOTES_FILE"
    echo "$DOCS" >> "$RELEASE_NOTES_FILE"
    echo "" >> "$RELEASE_NOTES_FILE"
fi

if [ -n "$CHORES" ]; then
    echo "### 🔧 Maintenance" >> "$RELEASE_NOTES_FILE"
    echo "$CHORES" >> "$RELEASE_NOTES_FILE"
    echo "" >> "$RELEASE_NOTES_FILE"
fi

if [ -n "$OTHERS" ]; then
    echo "### 📦 Other Changes" >> "$RELEASE_NOTES_FILE"
    echo "$OTHERS" >> "$RELEASE_NOTES_FILE"
    echo "" >> "$RELEASE_NOTES_FILE"
fi

# Add Docker images section
cat >> "$RELEASE_NOTES_FILE" << HEREDOC

## 🐳 Docker Images

### Docker Hub

**GCopy Backend:**
\`\`\`bash
docker pull llaoj/gcopy:v$VERSION_NUM
docker pull llaoj/gcopy:latest
\`\`\`

**GCopy Frontend:**
\`\`\`bash
docker pull llaoj/gcopy-frontend:v$VERSION_NUM
docker pull llaoj/gcopy-frontend:latest
\`\`\`

### Aliyun ACR (China)

**GCopy Backend:**
\`\`\`bash
docker pull registry.cn-beijing.aliyuncs.com/llaoj/gcopy:v$VERSION_NUM
docker pull registry.cn-beijing.aliyuncs.com/llaoj/gcopy:latest
\`\`\`

**GCopy Frontend:**
\`\`\`bash
docker pull registry.cn-beijing.aliyuncs.com/llaoj/gcopy-frontend:v$VERSION_NUM
docker pull registry.cn-beijing.aliyuncs.com/llaoj/gcopy-frontend:latest
\`\`\`
HEREDOC

echo "📄 Generated release notes:"
echo "================================"
cat "$RELEASE_NOTES_FILE"
echo "================================"
echo ""

# Ask for confirmation
read -p "🚀 Create release with these notes? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "❌ Release cancelled"
    rm "$RELEASE_NOTES_FILE"
    exit 1
fi

# Create the release
echo "🚀 Creating GitHub release..."
gh release create "v$VERSION_NUM" \
    --title "Release v$VERSION_NUM" \
    --notes-file "$RELEASE_NOTES_FILE" \
    --latest

rm "$RELEASE_NOTES_FILE"

echo "✅ Release v$VERSION_NUM created successfully!"
echo "🔗 View at: https://github.com/llaoj/gcopy/releases/tag/v$VERSION_NUM"
