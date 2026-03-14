---
name: release
description: Generate intelligent GitHub release notes with AI-powered analysis. Use this skill when you need to create a release, the user mentions release creation, or asks to publish a new version. Automatically analyzes commits since the last release, identifies key changes, acknowledges contributors, and includes Docker image references for both Docker Hub and Aliyun ACR.
---

# Release Skill

Generate intelligent GitHub release notes using AI analysis.

## Usage

```
/release [version]
```

- `version`: Optional version number (e.g., v1.5.0). If not provided, uses version.txt

## Instructions

When this skill is invoked, follow these steps:

### Step 1: Gather Information

1. Check if `gh` CLI is authenticated:
   ```bash
   gh auth status
   ```

2. Determine the version to release:
   - If version argument provided, use it
   - Otherwise, read from `version.txt`

3. Get the previous release version:
   ```bash
   gh release list --limit 20
   ```
   Find the latest release (not just tag) before the current version

4. Get commits between the previous release and current version:
   ```bash
   git log <previous-release>..<current-version> --pretty=format:"%H|%an|%ae|%s" --no-merges
   ```

5. Get contributor information:
   ```bash
   git log <previous-release>..<current-version> --pretty=format:"%an|%ae" --no-merges | sort | uniq
   ```

### Step 2: Analyze and Generate Release Notes

**IMPORTANT**: Use AI intelligence to analyze commits, NOT simple string matching!

Analyze the commits deeply:
- Understand the context and impact of each change
- Identify the main themes and highlights of this release
- Explain WHY changes were made, not just WHAT changed
- Group related changes together logically
- Provide upgrade guidance if there are breaking changes
- Highlight security fixes prominently
- Identify the most impactful features for users

Generate a release notes structure:

```markdown
## 🎯 Release Highlights

[AI-generated summary of the most important changes and their impact on users]

## What's Changed

### ✨ New Features

[Describe new features with context and benefits]

### 🐛 Bug Fixes

[Explain what was fixed and the impact]

### ♻️ Code Refactoring

[Describe architectural improvements and their benefits]

### 📝 Documentation

[Documentation updates]

### 🔧 Maintenance

[Chores and maintenance tasks]

## 🙏 Contributors

Thanks to all contributors who made this release possible:

[List contributors with their GitHub profiles]

## 🐳 Docker Images

### Docker Hub

```bash
docker pull llaoj/gcopy:<version>
docker pull llaoj/gcopy:latest
```

### Aliyun ACR (China)

```bash
docker pull registry.cn-beijing.aliyuncs.com/llaoj/gcopy:<version>
docker pull registry.cn-beijing.aliyuncs.com/llaoj/gcopy:latest
```
```

### Step 3: Create the Release

1. Save the generated release notes to a temporary file

2. Show the user the generated release notes and ask for confirmation

3. If confirmed, create the GitHub release:
   ```bash
   gh release create <version> \
     --title "Release <version>" \
     --notes-file <temp-file> \
     --latest
   ```

4. Provide the release URL to the user

## Example

```
User: /release v1.5.0

Assistant:
✅ Gh CLI authenticated
📦 Preparing release for version: v1.5.0
📋 Previous release: v1.4.8
📝 Analyzing 22 commits...

## 🎯 Release Highlights

This release introduces Token Authentication Mode, providing a simpler alternative to email-based login. The authentication system has been completely refactored using the strategy pattern, making it more maintainable and extensible. Additionally, clipboard handling has been significantly improved with support for WeChat images, progress indicators, and better handling of large content.

[... full release notes ...]

🚀 Create release with these notes? (y/n)
```

## Notes

- Always compare against the previous RELEASE, not just the previous TAG
- Use AI intelligence to provide context and insights, not just categorize commits
- Be helpful and informative, focus on what matters to users
- Include all contributors to acknowledge their work
- Provide clear Docker image pull commands for both registries
