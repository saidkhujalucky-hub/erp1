# EduERP

Cloudflare Worker and D1 application for a learning center. The interface supports Russian, Uzbek and English. Administrator can add teachers, students, groups, enrollment, lessons and payments; assigned teachers can see their own groups, record attendance and grades. Payment data is restricted server-side.

## Development

Install Node.js, then `npm install`. Create a D1 database with Wrangler, replace the database_id in wrangler.toml, and apply schema.sql. Set SETUP_SECRET as a Worker secret. Send a POST request to /api/setup with JSON fields secret and password (at least 12 characters); this creates the admin account once. Remove the setup secret after initialization. The admin can create teachers. Never commit real passwords or secrets. For local development, use `npx wrangler d1 execute eduerp-db --local --file=schema.sql`, define SETUP_SECRET in .dev.vars, and run `npm run dev`.

This is an initial implementation. Editing and deletion of records, password reset, login throttling, operational backups and production deployment still need to be completed and verified before real student data is used.

