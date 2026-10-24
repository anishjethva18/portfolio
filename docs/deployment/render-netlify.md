# Render + Netlify deployment guide

Yeh portfolio do parts mein chalta hai:

- **Netlify:** React/Vite frontend (`client/`).
- **Render:** Express API (`server/`), jo MongoDB aur private uploads se connect hoti hai.

Frontend API ko same-origin `/api/...` requests bhejta hai. Isliye Netlify ko API requests Render par proxy karni hongi. Sirf `client/` ko Netlify par bhejne se admin, login, uploads, messages aur database features kaam nahi karenge.

## 1. GitHub par poora project push karein

Repo ko GitHub par push karein, phir GitHub account ko Render aur Netlify se connect karein. Dono services ko **isi repository** se deploy karna hai:

- **Render ko poora repo chahiye**, kyunki usse `server/` aur production frontend build (`client/dist/`) dono chahiye.
- **Netlify source ke liye poora repo clone kar sakta hai**, lekin publish sirf `client/dist/` hoga.
- `server/.env`, koi bhi `.env`, `node_modules/`, ya `server/storage/` ko GitHub par upload/commit **na karein**.

### Pehli baar GitHub par push — Windows PowerShell

1. GitHub par **New repository** banayein. Is project ke liye **empty repository** banayein; GitHub se README, `.gitignore`, ya license initialize na karein.
2. Agar Git install nahi hai, PowerShell mein Git for Windows install karein, phir PowerShell dobara open karein:

   ```powershell
   winget install --id Git.Git --exact --source winget
   ```

3. PowerShell mein project root par aayein:

   ```powershell
   Set-Location 'E:\College\portfolio\windows-11-os-portfolio'
   ```

4. Git installed hai aur project abhi Git repository nahi hai to initialize karein:

   ```powershell
   git --version
   git init
   git branch -M main
   ```

   Agar folder mein pehle se `.git` repository hai to `git init` dobara chalane ki zaroorat nahi; `git status` aur `git remote -v` se check karein.

5. Commit author name/email configure karein (apni details se replace karein; ek computer par ek baar karna hota hai):

   ```powershell
   git config --global user.name "Your Name"
   git config --global user.email "you@example.com"
   ```

6. Commit se pehle files aur ignored secret paths check karein:

   ```powershell
   git status --short
   git check-ignore -v server/.env client/.env server/storage
   ```

   Teeno paths ignored dikhne chahiye. Agar `server/.env`, koi real `.env`, ya `server/storage/` `git status` mein dikh raha ho, **aage push na karein**. `.gitignore` theek karein; agar secret pehle se tracked hai to use index se hatakar (local file delete kiye bina) check karein:

   ```powershell
   git rm --cached -- server/.env
   git rm --cached -- client/.env
   git rm -r --cached -- server/storage
   ```

   In `git rm` commands ko sirf us path ke liye chalayein jo `git ls-files` mein tracked nikle; command error aaye to bina samjhe doosre paths par repeat na karein. Agar credentials kabhi commit/push ho chuke hain to unhein provider se rotate karein—sirf file delete karna kaafi nahi.

7. Source files stage karein aur staged list dobara verify karein:

   ```powershell
   git add -A
   git diff --cached --name-only
   ```

   List mein `.env`, secrets, `node_modules`, `client/dist`, ya `server/storage` nahi hone chahiye. Koi sensitive file list mein ho to commit na karein; pehle unhein index se hata kar `.gitignore` sahi karein.

8. Initial commit aur GitHub remote set karein. URL ko apne GitHub repository URL se badlein. Agar `git remote -v` mein `origin` pehle se maujood hai to `git remote add` na chalayein; URL replace karne ke liye `git remote set-url origin https://github.com/YOUR-GITHUB-USERNAME/YOUR-REPOSITORY.git` use karein:

   ```powershell
   git commit -m "Prepare portfolio for deployment"
   git remote add origin https://github.com/YOUR-GITHUB-USERNAME/YOUR-REPOSITORY.git
   git remote -v
   git push -u origin main
   ```

   GitHub authentication prompt aaye to GitHub ke browser/device login ya approved credential manager ka use karein; password/token ko command line, source file, ya chat mein na likhein.

### Baad mein code update karke push karna

Har code/config change ke baad repo root mein:

```powershell
git status --short
git diff --check
npm --prefix server run test:email
npm --prefix server run typecheck
npm --prefix server run build
npm --prefix client run typecheck
npm --prefix client run build
git add -A
git diff --cached --name-only
git commit -m "Describe the deployment change"
git push
```

Commit se pehle staged file list mein `.env`, secrets, `node_modules`, `client/dist`, ya `server/storage` nahi hain, ye confirm karein. Successful `git push` ke baad Render aur Netlify connected branch se deploy shuru karenge; dashboards ke Deploy/Deploys logs mein result dekhein. Agar pehli baar remote add karna baaki ho, pehle upar wale `git remote add origin ...` aur `git push -u origin main` commands chalayein.

## 2. MongoDB Atlas taiyar karein

1. MongoDB Atlas mein project aur database cluster banayein.
2. Database user banayein jiske paas sirf is portfolio database ke liye zaroori access ho.
3. Atlas ka connection string lein; usmein database name `win11portfolio` rakh sakte hain.
4. Atlas Network Access mein Render service ko database se connect karne dein. Agar Render par fixed outbound IP available/configured nahi hai, Atlas ke IP allow-list ke liye hosting ke mutabiq rule chahiye hoga. `0.0.0.0/0` use karna pade to strong unique database password zaroor rakhein, aur URI ko kabhi frontend ya GitHub mein na rakhein.

## 3. Render par backend deploy karein

1. Render dashboard → **New** → **Web Service** → GitHub repository select karein.
2. **Root Directory** blank/repo root rakhein.
3. Runtime **Node** select karein.
4. Commands:

   **Build Command**

   ```bash
   npm ci --prefix server && npm ci --prefix client && npm --prefix client run build && npm --prefix server run build
   ```

   **Start Command**

   ```bash
   npm --prefix server start
   ```

5. Service banne ke baad Render ka public URL note karein, misaal: `https://your-portfolio-api.onrender.com`.

### Render environment variables

Render Web Service → **Environment** mein ye variables set karein. Values ke aage/peeche quotes mat lagayein:

| Variable | Value |
| --- | --- |
| `NODE_ENV` | `production` |
| `MONGODB_URI` | Atlas ka poora connection string, database `win11portfolio` ke saath |
| `APP_URL` | Aapka public Netlify site URL, jaise `https://your-site.netlify.app` |
| `CORS_ALLOWED_ORIGINS` | Wahi Netlify URL; custom domain ho to comma-separated dono origins, jaise `https://your-site.netlify.app,https://portfolio.example.com` |
| `EMAIL_PUBLIC_BASE_URL` | Optional override; email favicon ke liye backend ka public HTTPS origin. Render par app ise `RENDER_EXTERNAL_URL` se automatically detect karti hai. |
| `ADMIN_EMAIL` | Aapka administrator email |
| `ADMIN_SETUP_TOKEN` | Ek lamba, random, ek baar ke setup ke liye token |
| `EMAIL_HOST` | Optional SMTP host; Gmail ke liye `smtp.gmail.com` |
| `EMAIL_PORT` | Optional SMTP port; Gmail STARTTLS ke liye `587` |
| `EMAIL_SECURE` | Optional; `false` for Gmail STARTTLS on port 587 |
| `EMAIL_USER` | Optional SMTP/Gmail account |
| `EMAIL_PASS` | Optional SMTP password ya Gmail App Password; normal Gmail password nahi |
| `EMAIL_FROM` | Optional sender label/address, jaise `Portfolio <you@example.com>` |
| `CONTACT_RECEIVER_EMAIL` | Optional inbox for portfolio inquiries |
| `GEMINI_API_KEY` | Optional; sirf Gemini features use karne par |

SMTP credentials startup ke liye required nahi hain. Credentials configure na hon to email simulation mode use hota hai; password reset delivery aur contact email ke liye working SMTP configure karke real inbox mein test karein. Administrator setup ke liye `ADMIN_EMAIL`, `MONGODB_URI`, HTTPS `APP_URL`, aur one-time `ADMIN_SETUP_TOKEN` configure karein. Render apna `PORT` khud provide karta hai; aam taur par ise manually set na karein.

`APP_URL` frontend ka URL hai taaki password-reset link visitor ko Netlify site par wapas le jaye. Email favicon ke liye app pehle `EMAIL_PUBLIC_BASE_URL`, phir Render ka automatic `RENDER_EXTERNAL_URL` use karti hai; non-Render hosting par alag frontend/API domains hon to `EMAIL_PUBLIC_BASE_URL` ko backend ke public HTTPS origin par set karein. Ye email HTML mein remote image URL hota hai—email mein favicon attachment nahi bheja jata.

### Uploaded files aur backups ko persistent rakhein

MongoDB database content/accounts sambhalta hai, lekin uploaded files aur server backups disk par private storage root mein hote hain. Production mein default root `server/storage/` hai; backups default `server/storage/backup/` mein bante hain, aur administrator camera archives `server/storage/AdminArchive/` ke andar hoti hain. Render Web Service ke liye persistent disk configure karein:

- **Mount Path:** `/opt/render/project/src/server/storage` (jab Render Root Directory repo root ho).
- Agar Render ne service ka project path alag diya ho, mount path ko us deployment mein repo ke `server/storage/` ke actual absolute path par set karein.
- Disk ke bina redeploy/restart par uploaded media aur server-side backups kho sakte hain.
- `PORTFOLIO_STORAGE_DIR` aur `PORTFOLIO_BACKUP_DIR` ke external overrides production mein ignore hote hain; production code private storage ke project-local `server/storage/` aur `server/storage/backup/` paths par hi rahta hai.

Render disk har plan mein available nahi hoti; persistent disk ke liye plan/billing requirements Render dashboard mein check karein. Is project ko disk ke bina production mein chalane se pehle uploads ke liye alag persistent object-storage solution implement karna hoga.

### Pehla admin account banayein

Render service deploy ho jaane aur Atlas connect ho jaane ke baad Render dashboard ke **Shell** mein ye chalayein. Password prompt par password type karte waqt woh terminal mein nahi dikhega:

```bash
read -s -p "Admin password (12+ characters): " PORTFOLIO_ADMIN_PASSWORD
echo
export PORTFOLIO_ADMIN_PASSWORD
npm --prefix server run create-admin -- your-admin@example.com
unset PORTFOLIO_ADMIN_PASSWORD
```

Email ko `ADMIN_EMAIL` ke saath match karein. Script `ADMIN_SETUP_TOKEN` environment variable ko use karegi. Setup successful hone ke baad Render Environment se `ADMIN_SETUP_TOKEN` hata dein aur service redeploy karein. Production bootstrap one-time hai; agar database mein admin pehle se maujood hai to naya admin bootstrap nahi hoga.

## 4. Netlify par frontend deploy karein

1. Netlify dashboard → **Add new site** → **Import an existing project** → wahi GitHub repository select karein.
2. Base directory blank/repo root rakhein.
3. Build command: `npm ci --prefix client && npm --prefix client run build`
4. Publish directory: `client/dist`
5. Deploy se pehle API proxy rule neeche diye gaye tareeqe se configure karein.

Repo mein root [netlify.toml](../../netlify.toml) `client/` dependencies install karke `client/dist` build/publish karta hai aur SPA ke liye `/*` fallback redirect rakhta hai. Is fallback se **pehle** `/api/*` proxy rule add karein. `YOUR-RENDER-SERVICE` ko Render ke actual service hostname se replace karein:

```toml
[[redirects]]
  from = "/api/*"
  to = "https://YOUR-RENDER-SERVICE.onrender.com/api/:splat"
  status = 200
  force = true
```

Order important hai: API proxy rule SPA fallback se pehle hona chahiye. Apna Render URL badalne par is rule ko bhi update karke Netlify redeploy karein. Netlify deploy settings mein command/publish directory ko root `netlify.toml` ke values ke saath match rakhein.

Deploy ke baad Netlify ka public URL note karein. Agar custom domain bhi use karte hain, Render ke `APP_URL` aur `CORS_ALLOWED_ORIGINS` mein exact HTTPS origins update karein, phir Render redeploy karein.

## 5. Dono services ke connection ko test karein

1. Browser mein `https://YOUR-RENDER-SERVICE.onrender.com/api/health` kholein. API health response aana chahiye.
2. Browser mein `https://YOUR-NETLIFY-SITE.netlify.app/api/health` kholein. Ye Netlify proxy ke zariye wahi API response dena chahiye.
3. Netlify site par portfolio content load karein; phir admin login, publish, contact aur media upload test karein.
4. Admin se ek chhota test media upload karke Render persistent disk/redeploy ke baad bhi usse verify karein.
5. Favicon email mein chahiye aur attachment nahi chahiye to SEO & Sharing mein favicon set/publish karein aur `emailFaviconEnabled` on rakhein. Render par API origin `RENDER_EXTERNAL_URL` se automatically use hoga; non-Render hosting par frontend aur API alag hon to `EMAIL_PUBLIC_BASE_URL` ko API ke public HTTPS origin par set karein. Naye email mein remote image display allow karke header check karein. `localhost` ya relative `/api/...` URL email recipient ke device se accessible nahi hota.

### Local email mein favicon test karna

Gmail jaise mail clients image ko apne remote image proxy se fetch karte hain; woh aapke computer ke `localhost` ko access nahi kar sakte. Local test ke liye Cloudflare Quick Tunnel se API ko temporary HTTPS URL dein:

1. Install Cloudflare Tunnel (`cloudflared`) if it is not installed.
2. App ko `http://localhost:3000` par chalu rakhein. Ek alag PowerShell window mein tunnel start karein:

   ```powershell
   cloudflared tunnel --url http://localhost:3000
   ```

3. Output mein diya gaya `https://....trycloudflare.com` URL copy karein. `server/.env` mein ye line add/update karein:

   ```dotenv
   EMAIL_PUBLIC_BASE_URL=https://....trycloudflare.com
   ```

4. Backend ko restart karein; tunnel window ko khula rakhein. Pehle browser mein `https://....trycloudflare.com/api/email/favicon?id=YOUR_FAVICON_FILE_ID` kholkar image load hoti hai verify karein. Favicon ID admin ke saved `/api/portfolio-media/YOUR_FAVICON_FILE_ID` URL se aati hai.
5. Ab contact form se **naya** email bhejein. Email template `https://....trycloudflare.com/api/email/favicon?id=...` ko point karna chahiye. Test ke dauran tunnel chalu rakhein.

Quick Tunnel temporary/public hai aur local app/API ko internet se reachable banata hai. Sirf tab chalayein jab image test kar rahe hain, test ke baad tunnel ko `Ctrl+C` se stop karein. URL badal sakta hai; agle test ke liye `.env` update karke backend restart karein.

### Existing local content ko live deployment par lana

Naya Render service apne aap aapke computer ke MongoDB ya `server/storage/` ko copy nahi karta. Pehle local admin se backup lein; phir deployed admin ke Backup & Restore section se supported backup restore karein, aur zaroori uploaded files ko persistent storage mein rakhein. Restore ke baad public site, admin, resume, favicon, social image aur uploads verify karein. Local `server/storage/` ko GitHub par push na karein.

## Troubleshooting

| Samasya | Kya check karein |
| --- | --- |
| Netlify par API ki jagah website HTML aati hai | `/api/*` proxy rule maujood hai, URL mein actual Render hostname hai, aur rule `/*` fallback se upar hai. |
| API 404 ya `502` | Render deployment logs, `/api/health`, service hostname, aur Render ka live status check karein. |
| Browser CORS error | `CORS_ALLOWED_ORIGINS` mein browser address bar wala exact HTTPS Netlify/custom origin daalein; trailing slash na daalein. |
| Admin login/session kaam nahi karta | `NODE_ENV=production`, HTTPS Netlify origin, MongoDB connectivity, Render logs, aur Netlify `/api/*` proxy check karein. |
| Deploy ke baad media/backup gayab | Render persistent disk `server/storage/` par mount hai ya nahi check karein. |
| Email header favicon gayab, attachment nahi | SEO & Sharing mein favicon publish aur `emailFaviconEnabled` on check karein. Naye email ke image address mein public API hostname aur `/api/email/favicon?id=...` hona chahiye; relative `/api/portfolio-media/...` link ya `localhost` recipient ke email client se load nahi hoga. Render deploy log mein latest server source ke baad `npm --prefix server run build` successful hona chahiye; `server/server.bundle.cjs` generated/ignored file hai, isliye purana bundle manually upload na karein. Image URL browser mein kholne par login ke bina image return honi chahiye. Email client mein remote-image display bhi allow karein. Local-only server ke liye public HTTPS tunnel ka origin `EMAIL_PUBLIC_BASE_URL` mein set karke server restart karein. |

## Kya deploy karna hai — short answer

- **GitHub:** project ka source repo, `client/`, `server/`, dono lockfiles, aur config files. `.env`, secrets, `node_modules/`, private uploads/backup commit nahi.
- **Render:** GitHub repo select karein; Render build mein server dependencies, client build, server bundle tino bante hain. Environment variables aur persistent disk Render dashboard mein configure hote hain.
- **Netlify:** usi GitHub repo ko select karein; publish sirf `client/dist/`. Render service create hone ke baad `netlify.toml` mein API proxy rule add karke frontend ko backend se jodein.
