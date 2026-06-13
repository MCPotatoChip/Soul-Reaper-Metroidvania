@echo off
setlocal enabledelayedexpansion

echo =======================================================
echo Cloud Sync Setup: GitHub and Vercel
echo =======================================================
echo IMPORTANT: Make sure you are authenticated with both CLIs!
echo If you haven't already, please run:
echo   - gh auth login
echo   - vercel login
echo =======================================================
echo.

:: 1. Git Initialization Check
if not exist ".git" (
    echo [INFO] Initializing Git repository...
    git init
) else (
    echo [INFO] Git repository already initialized.
)

:: Ensure .gitignore exists and has required entries
if not exist ".gitignore" (
    echo [INFO] Creating .gitignore...
    echo node_modules/>> .gitignore
    echo .pnpm-store/>> .gitignore
    echo .vercel/>> .gitignore
    echo build/>> .gitignore
    echo dist/>> .gitignore
) else (
    echo [INFO] Updating .gitignore...
    findstr /C:"node_modules" .gitignore >nul || echo node_modules/>> .gitignore
    findstr /C:".pnpm-store" .gitignore >nul || echo .pnpm-store/>> .gitignore
    findstr /C:".vercel" .gitignore >nul || echo .vercel/>> .gitignore
)

echo [INFO] Adding files to git...
git add .
git commit -m "infra: initial monorepo workspace sync"

:: 2. GitHub Repository Provisioning via GitHub CLI
echo.
echo [INFO] Provisioning GitHub repository...
gh repo create Soul-Reaper-Metroidvania --public --source=. --remote=origin

echo [INFO] Setting branch to main and pushing to GitHub...
git branch -M main
git push -u origin main

:: 3. Vercel Project Linkage via Vercel CLI
echo.
echo [INFO] Creating vercel.json for project configuration...
echo {> vercel.json
echo   "name": "soul-reaper-metroidvania",>> vercel.json
echo   "buildCommand": "pnpm --filter @workspace/bleach-game build",>> vercel.json
echo   "rootDirectory": "artifacts/bleach-game">> vercel.json
echo }>> vercel.json

echo [INFO] Linking Vercel project workspace...
vercel link --yes

echo.
echo [INFO] Cloud sync setup complete! You can now run "vercel deploy" or push to main to trigger deployments.
