---
description: Build and deploy ZERTZ to local Docker (localhost:5050). MUST be run after ANY code change in this project.
---

# Deploy to Local Docker

**IMPORTANT RULE:** After making ANY code changes in this project (frontend, backend, styles, etc.), you MUST always rebuild and deploy to the local Docker environment at http://localhost:5050/. Do NOT wait for the user to ask — do it automatically after every change.

## Steps

// turbo-all

1. Build the frontend:
```
cmd /c "npm run build 2>&1"
```
Working directory: `c:\Users\karto\YandexDisk\coding\zertz`

2. Rebuild Docker and restart containers:
```
cmd /c "docker-compose down && docker-compose build --no-cache web && docker-compose up -d 2>&1"
```
Working directory: `c:\Users\karto\YandexDisk\coding\zertz`

3. Verify the server is running:
```
cmd /c "docker-compose logs --tail=5 web 2>&1"
```
Working directory: `c:\Users\karto\YandexDisk\coding\zertz`

Expected output should contain: `ZERTZ server running at http://localhost:5050`

4. Inform the user that the app is live at http://localhost:5050/
