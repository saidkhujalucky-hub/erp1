# EduERP

Cloudflare Worker and D1 application for a learning center. The interface supports Russian, Uzbek and English. Administrators manage teachers, students, groups, enrollment and lessons. Archiving a student preserves their history. Administrators can open monthly tuition charges for a group, apply payments and review outstanding balances. The server restricts payment data to administrators and checks lessons for overlapping rooms, teachers and groups. Teachers can record attendance and grades for their own groups and mark the remaining students present in one action.

## Development

Install Node.js, then `npm install`. Create a D1 database with Wrangler, replace the database_id in wrangler.toml, and apply schema.sql. Set SETUP_SECRET as a Worker secret. Send a POST request to /api/setup with JSON fields secret and password (at least 12 characters); this creates the admin account once. Remove the setup secret after initialization. The admin can create teachers. Never commit real passwords or secrets. For local development, use `npx wrangler d1 execute eduerp-db --local --file=schema.sql`, define SETUP_SECRET in .dev.vars, and run `npm run dev`.

For an existing installation, apply `migrations/0003_billing.sql` before deploying the monthly billing feature. Monthly charges are opened by an administrator for the current month. Existing payments can then be applied to eligible balances.

Password reset, login throttling and an operational backup procedure remain open deployment tasks.

