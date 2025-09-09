# Deployment instructions for Vercel

1. Copy `.env.example` to `.env.local` and set your backend API URL:
   
   ```env
   NEXT_PUBLIC_API_BASE_URL=https://your-backend-url.com
   ```
   Replace with your deployed backend URL.

2. Push your code to GitHub, GitLab, or Bitbucket.

3. Import your repo into Vercel (https://vercel.com/import).

4. Set the environment variable `NEXT_PUBLIC_API_BASE_URL` in the Vercel dashboard.

5. Deploy!

---

- The `vercel.json` file is set up for custom rewrites if you want to proxy API requests.
- No changes needed to `package.json` scripts; they are Vercel-compatible.
