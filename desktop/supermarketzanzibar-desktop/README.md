# Supermarket Zanzibar Desktop

This is the separate Electron desktop frontend for the project.

It does not replace the web frontend in:

```txt
frontend/supermarketzanzibar
```

Instead, it wraps the hosted web app in a Windows desktop application.

## Start the desktop app

```bash
npm run desktop
```

## Build the Windows installer

```bash
npm run desktop:dist
```

## Change the loaded web URL

Default:

```txt
https://supermarketzanzibar.vercel.app
```

Override:

```bash
set ELECTRON_START_URL=https://your-frontend-url
npm run desktop
```
