# Access Note

## URLs
- Public form: `http://localhost:5173/`
- Admin portal: `http://localhost:5173/admin`

## Admin Login Credentials

### Super Admin
- `superadmin` or `superadmin@smhos.org` / `Admin@1234`

### Service Unit Leader (Media & Service)
- `chuks` or `chuks@smhos.org` / `Ibiyeomie@58`

### Sub-Unit Leader (Media & Service — Audio)
- `inatimi` or `inatimi@smhos.org` / `Ibiyeomie@58`

### Country Super Admin (Nigeria)
- `country.admin` or `country.admin@smhos.org` / `Ibiyeomie@58`

### State Super Admin (Rivers, Nigeria)
- `rivers.state` or `rivers.state@smhos.org` / `Ibiyeomie@58`

## Local dev & Netlify

```bash
npm install
npm run dev    # http://localhost:5173
npm run build  # output in dist/ — Netlify uses this (see netlify.toml)
```

## LocalStorage Note
- Admin accounts are stored in browser localStorage (`sm_admin_demo_db_v1`).
- The app may reset the admin list when the roster version in code changes (`sm_admin_roster_rev`).
- If login data gets out of sync, clear localStorage for this site and refresh.
