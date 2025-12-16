# Deploying to Netlify

This guide explains how to deploy the frontend to Netlify while keeping the backend running on Replit.

## Architecture

```
┌─────────────────────┐         ┌─────────────────────┐
│   Netlify           │         │   Replit            │
│   (Frontend)        │  API    │   (Backend)         │
│                     │ ──────► │                     │
│   React App         │         │   Express + JSON    │
│   Static Files      │         │   data.json         │
└─────────────────────┘         └─────────────────────┘
```

## Step 1: Deploy Backend on Replit

1. Click the **Deploy** button in Replit
2. Your backend will be available at a URL like:
   `https://your-repl-name.your-username.repl.co`
3. Copy this URL - you'll need it for Netlify

## Step 2: Deploy Frontend on Netlify

### Option A: Deploy via Git

1. Push your code to GitHub
2. Go to [Netlify](https://app.netlify.com) and create a new site
3. Connect your GitHub repository
4. Configure build settings:
   - **Build command:** `npm run build`
   - **Publish directory:** `dist/public`
5. Add environment variable:
   - **Key:** `VITE_API_BASE_URL`
   - **Value:** `https://your-replit-app-url.replit.dev` (your Replit deployment URL)
6. Deploy!

### Option B: Deploy via CLI

```bash
# Install Netlify CLI
npm install -g netlify-cli

# Login to Netlify
netlify login

# Build the frontend
npm run build

# Deploy
netlify deploy --prod --dir=dist/public
```

Then set the environment variable in Netlify dashboard:
- Go to Site settings → Environment variables
- Add `VITE_API_BASE_URL` = your Replit URL

## Step 3: Update CORS (if needed)

If your Netlify site has a custom domain, update the CORS configuration in `server/index.ts`:

```typescript
app.use(cors({
  origin: [
    "http://localhost:5173",
    "http://localhost:5000",
    /\.netlify\.app$/,
    /\.netlify\.com$/,
    "https://your-custom-domain.com"  // Add your domain here
  ],
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));
```

## Demo Credentials

- **Creator:** Priyanka.k@cybaemtech.com / 123
- **Approver:** approver@cybaem.com / 123
- **Issuer:** issuer@cybaem.com / 123
- **Admin:** admin@cybaem.com / 123

## Important Notes

1. **Keep Replit running:** The backend must be running on Replit for the app to work
2. **Environment variable:** Make sure `VITE_API_BASE_URL` is set correctly in Netlify
3. **HTTPS:** Both Netlify and Replit use HTTPS by default, so everything works securely
