# Rental Management System

A web application for landlords and property agents in Kenya. It keeps track of
properties, units, tenants and contracts, bills rent and utilities every month,
records payments, chases arrears, and produces the documents that go with all
of it: invoices, receipts, statements and move-out settlements.

Amounts are in Kenyan shillings (KES). The screenshots below use made-up demo
data.

![Dashboard](docs/screenshots/01-dashboard.png)

## Contents

- [What the system does](#what-the-system-does)
- [A tour of the system](#a-tour-of-the-system)
- [How the money is worked out](#how-the-money-is-worked-out)
- [How it is built](#how-it-is-built)
- [Running it](#running-it)
- [Configuration](#configuration)
- [Tests](#tests)
- [M-Pesa paybill](#m-pesa-paybill)
- [Security](#security)
- [Known limitations](#known-limitations)

## What the system does

| Area | What you can do |
|---|---|
| Set up | Add properties, the units inside them, and the tenants who rent them. Set each property's billing rules. |
| Contracts | Rent a unit to a tenant, renew a contract that is ending, and move a tenant out with the deposit settled. |
| Billing | Generate invoices every month from meter readings, with late-payment penalties and the unpaid balance brought forward. |
| Payments | Record a payment from any page and get a receipt. Receive M-Pesa paybill payments automatically. |
| Collections | See who owes, how much and for how long, and send a reminder on WhatsApp. |
| Documents | Print, download as PDF, or send on WhatsApp: invoices, receipts, tenant statements, move-out statements. |
| Costs | Record expenses by type (salaries, cleaning, security and so on) and track repair requests. |
| Reports | Financial, occupancy, tenant, utility and executive reports, exportable to CSV. |

## A tour of the system

The sidebar lists the pages in the order a landlord works through them. The
property chosen in the top bar applies to every page.

### 1. Sign in

![Login](docs/screenshots/19-login.png)

Accounts are created by the administrator; public sign-up is switched off (see
[Security](#security)). Five wrong passwords lock that login for 15 minutes.
When a session expires, signing in again returns you to the page you were on.

### 2. Dashboard

The first screenshot on this page. It shows what was collected this month,
occupancy, rent still to collect, and charts of collection and expenses. Two
things on it are there to be acted on:

- **Contracts ending soon** lists contracts that end within 60 days or have
  already run past their end date. **Renew** sets a new end date; the WhatsApp
  button asks the tenant whether they want to renew.
- **Record payment** opens the payment dialog directly.

### 3. Properties and their settings

![Properties](docs/screenshots/02-properties.png)

A property is a building or plot. Everything else belongs to one. Each property
has its own billing rules under **Settings**:

![Settings](docs/screenshots/18-settings.png)

| Setting | Effect |
|---|---|
| Rent deposit (months) | The deposit asked for on a new contract. |
| Late payment penalty (%) | Charged on what is unpaid once the grace period has passed. |
| Grace period (days) | How long after an invoice is issued before it counts as overdue. |
| Include water / electricity / service / security / other | Which charges appear on the monthly invoice. |
| Unit costs | Price per unit of water and electricity, used with the meter readings. |
| Deposit requirements | Whether new tenants also pay a water or electricity deposit. |

### 4. Units

![Units](docs/screenshots/03-units.png)

The houses, rooms or shops inside a property. A vacant unit has **Rent out**,
which creates a contract. An occupied unit has **Move out** (see step 11). The
balance column is what the unit's current tenant owes.

### 5. Tenants

![Tenants](docs/screenshots/04-tenants.png)

The people who rent. A tenant is registered with phone number, ID number and
photos of both sides of their ID. The document icon opens the tenant's
statement.

### 6. Contracts

![Contracts](docs/screenshots/05-contracts.png)

A contract puts one tenant in one unit, with a rent, a deposit, a start date, an
optional end date and a payment frequency (monthly, quarterly or yearly). A unit
has one active contract at a time, and so does a tenant. Creating a contract:

1. marks the unit occupied,
2. moves the tenant into it, and
3. issues the first invoice: the first period's rent, the deposit, and any water
   or electricity deposit the property requires.

Contracts can be printed. Ended contracts keep their move-out statement.

### 7. Invoices

![Invoices](docs/screenshots/06-invoices.png)

**Generate monthly invoices** bills every active contract in the property for
the chosen month. You enter each unit's water and electricity meter readings and
the system works out the bills. A contract is billed once per month; running it
again skips contracts already billed.

Each new invoice brings forward whatever the tenant has not paid, so **the
latest invoice always stands for the whole account**:

- The latest invoice of a tenant shows the balance and has the **Pay** button.
- Earlier invoices that were not fully paid show **Carried over**: their balance
  now sits on a later invoice.
- A tenant who paid too much shows a **credit**, which comes off their next
  invoice.

The printer icon opens the invoice as a document:

![Invoice document](docs/screenshots/07-invoice-document.png)

An invoice with payments recorded against it cannot be deleted.

### 8. Payments

Rent is recorded through one dialog, opened from Invoices, Arrears, Payments or
the dashboard. It starts from the full balance and tells you what the payment
will leave: still owing, cleared, or overpaid.

![Record a payment](docs/screenshots/08-record-payment.png)

Saving it shows the receipt straight away, ready to print, download or send on
WhatsApp:

![Receipt](docs/screenshots/09-receipt.png)

The **Payments** page lists money in and money out for the month. Every incoming
payment has its receipt. **Record payment** here lets you pick the tenant from
those who owe.

![Payments](docs/screenshots/10-payments.png)

The **M-Pesa paybill** tab shows payments reported by Safaricom. Most are
matched to a tenant automatically; the ones that cannot be are matched by hand.

![M-Pesa paybill](docs/screenshots/11-mpesa-paybill.png)

### 9. Arrears

![Arrears](docs/screenshots/12-arrears.png)

One row per tenant who owes, most overdue first: the amount, when it started,
how many days past the grace period, and when they last paid. Each row has
**Pay**, a WhatsApp reminder with the amount and due date filled in, and a link
to the statement. Tenants who moved out still owing stay on this list until they
pay.

### 10. Tenant statement

![Tenant statement](docs/screenshots/13-tenant-statement.png)

Every invoice and payment of one tenant in date order, with the balance after
each line. It can be limited to a date range, in which case it opens with the
balance brought forward. Open it from Tenants, Contracts or Arrears.

### 11. Moving a tenant out

![Move out](docs/screenshots/14-move-out.png)

**Move out** on the Units page ends the contract and settles the deposit in one
step:

1. Enter the final meter readings. The water and electricity used since the last
   invoice are billed on a final invoice.
2. Enter any deductions for repairs or cleaning.
3. The system takes what the tenant owes and the deductions off the deposit.
   What is left is the refund; if the deposit does not cover it, the tenant still
   owes the difference and stays on the Arrears page.
4. A refund can be recorded as money paid out. It is filed as an expense of type
   "Deposit refund".

The unit becomes vacant and its monthly invoices stop. The move-out statement,
with space for both signatures, can be reopened from the ended contract.

### 12. Expenses and maintenance

![Expenses](docs/screenshots/15-expenses.png)

Expenses are recorded against a property with a type: cleaning, salaries and
wages, repairs, water and electricity, security, garbage collection, rates and
taxes, insurance, management fees, supplies, deposit refund, or other. The chips
above the table show what was spent on each type; clicking one lists only those
expenses. An expense can be paid in full or in part.

![Maintenance](docs/screenshots/16-maintenance.png)

Maintenance requests record a problem in a unit, by type (plumbing, electrical,
carpentry, painting and so on), with a status that moves from pending to in
progress to resolved, and the cost of the repair.

### 13. Reports

![Reports](docs/screenshots/17-reports.png)

Reports are grouped as Financial, Occupancy & Units, Tenants, Utilities &
Maintenance and Executive. Each takes the filters that make sense for it
(property, dates, unit type and so on), shows summary figures and tables, and
exports each table to CSV.

### Documents

Four documents are produced as A4 PDFs, drawn directly so the text is sharp and
selectable. Each can be downloaded, printed, or summarised in a WhatsApp message
to the tenant.

| Invoice | Receipt |
|---|---|
| ![Invoice PDF](docs/screenshots/pdf-invoice.png) | ![Receipt PDF](docs/screenshots/pdf-receipt.png) |

| Tenant statement | Move-out statement |
|---|---|
| ![Statement PDF](docs/screenshots/pdf-statement.png) | ![Move-out PDF](docs/screenshots/pdf-moveout.png) |

## How the money is worked out

These rules live in one place, `rental-backend/app/billing.py`, and every page
uses them.

- **What a tenant owes** is everything charged on their invoices minus
  everything they have paid. The "balance brought forward" line on an invoice
  repeats earlier charges, so it is not counted as a new charge.
- **Each invoice brings the unpaid balance forward.** A tenant therefore only
  ever needs to pay their latest invoice.
- **Payments go to the latest invoice.** A payment quoted against an older
  invoice (for example an M-Pesa payment with last month's invoice number) is
  credited to the tenant's latest one.
- **Overpayments become credit.** The extra is carried as a negative balance and
  taken off the next invoice.
- **Late penalty.** When monthly invoices are generated, a tenant whose oldest
  unpaid invoice is past the grace period is charged the property's penalty rate
  on their whole unpaid balance. It appears as its own line.
- **Quarterly and yearly contracts.** The contract's rent is one month's rent.
  A quarterly contract is charged three months' rent every third month, counted
  from its start month; a yearly one twelve months' rent once a year. Utilities
  and service charges are still billed monthly.
- **Overdue** means the grace period has passed since the oldest unpaid invoice
  was issued.
- **Moving out.** Refund = deposit held − unpaid balance − deductions. A negative
  result is what the tenant still owes, and later payments reduce it.
- **Editing and deleting.** Editing or deleting a payment adjusts the invoice it
  was recorded against. Editing an invoice refreshes its paid status.
- **Numbers.** Invoices are shown as `INV-<contract>-<year><month>-<n>` and
  receipts as `RCT-<payment number>`. (Invoices are stored with an `RCT-`
  prefix for historical reasons; the screens and documents show `INV-`.)

## How it is built

```
Browser ──▶ rental-frontend (Angular 20, server-rendered) ──▶ rental-backend (Django REST) ──▶ PostgreSQL
                                                                        ▲
                                                Safaricom (M-Pesa paybill notifications)
```

| Part | Technology |
|---|---|
| Frontend | Angular 20 (standalone components, zoneless change detection), Angular Material, Chart.js, jsPDF |
| Backend | Django 5, Django REST Framework, JWT login (SimpleJWT), Gunicorn, WhiteNoise |
| Database | PostgreSQL |
| Packaging | One Docker image each for frontend and backend, started with Docker Compose |

### Folder layout

```
rent-managment/
├── docker-compose.yml        starts both services
├── docs/screenshots/         images used in this file
├── rental-backend/           Django project (its own git repository)
│   ├── app/
│   │   ├── models.py         properties, units, tenants, contracts, invoices, payments, expenses…
│   │   ├── billing.py        what a tenant owes, penalties, arrears, statements
│   │   ├── billing_views.py  statements, arrears, move-out, renewals, M-Pesa
│   │   ├── security.py       login and reset-code attempt limits
│   │   ├── views.py          everything else, including the reports
│   │   ├── tests.py          backend tests
│   │   └── management/commands/   recalculate_balances, register_paybill_urls, seed_demo
│   └── projects/settings.py  configuration, read from the environment
└── rental-frontend/          Angular project (its own git repository)
    └── src/app/
        ├── components/dashboard/   one folder per page
        ├── services/               API calls
        ├── shared/                 PDF drawing, WhatsApp and print helpers
        └── interceptors/           attaches the login token, renews it when it expires
```

### Main records

| Record | What it is |
|---|---|
| Property | A building or plot. Has one set of billing settings. |
| Unit | A rentable space in a property, with its meter readings and balance. |
| Customer | A tenant: contacts, ID number, ID photos. |
| RentalContract | A tenant in a unit: rent, deposit, dates, payment frequency. |
| Receipt | An **invoice** (the name is historical): the month's charges, meter readings, penalty, balance brought forward, and what has been paid. |
| Payment | Money in against an invoice, or money out against an expense or repair. |
| Expense / MaintenanceRequest | Costs of a property and repairs to its units, each with a type. |
| MoveOut | The deposit settlement made when a contract ended. |
| MpesaTransaction | A paybill payment reported by Safaricom, linked to the payment it created. |
| SystemParameter | A property's billing settings. |

## Running it

### With Docker (recommended)

1. Create `rental-backend/.env` with at least a database and a secret key (see
   [Configuration](#configuration)):

   ```
   DATABASE_URL=postgres://user:password@host:5432/dbname
   SECRET_KEY=<a long random string>
   ```

2. Start both services from this folder:

   ```
   docker compose up -d --build
   ```

   The backend applies database migrations when it starts.

3. Create the first account:

   ```
   docker compose exec backend python manage.py createsuperuser
   ```

4. Open http://localhost:4200 and sign in. The API is at http://localhost:8000.

Rebuild with the same `docker compose up -d --build` after changing code.

### Without Docker

Backend (it reads the same `rental-backend/.env`):

```
cd rental-backend
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
python manage.py migrate
python manage.py createsuperuser
python manage.py runserver
```

Frontend:

```
cd rental-frontend
npm install
npm start          # http://localhost:4200, talks to the API at http://127.0.0.1:8000/
```

### Useful commands

| Command | What it does |
|---|---|
| `python manage.py recalculate_balances` | Recomputes each unit's stored balance from its invoices and payments. |
| `python manage.py register_paybill_urls` | Tells Safaricom where to send paybill payments. |
| `python manage.py seed_demo` | Creates demo data (PostgreSQL only). `--clear` removes it. |

## Configuration

The backend reads its settings from the environment (or `rental-backend/.env`).

| Variable | Default | Purpose |
|---|---|---|
| `DATABASE_URL` | none, required | PostgreSQL connection. SSL is required. |
| `SECRET_KEY` | an insecure development key | Signs logins. Set a long random value in production. |
| `DEBUG` | `False` (`True` under Docker Compose) | Detailed error pages; also turns off the https redirect. |
| `ALLOWED_HOSTS` | `localhost,127.0.0.1` | Host names the backend answers to. |
| `CORS_ALLOWED_ORIGINS` | `http://localhost:4200` and the GitHub Pages site | Sites allowed to call the API. |
| `ALLOW_PUBLIC_SIGNUP` | `False` | Lets anyone register. Leave off; see [Security](#security). |
| `JWT_ACCESS_MINUTES` / `JWT_REFRESH_DAYS` | `15` / `7` | How long a login lasts before it is renewed, and before it ends. |
| `EMAIL_HOST`, `EMAIL_PORT`, `EMAIL_HOST_USER`, `EMAIL_HOST_PASSWORD`, `EMAIL_USE_TLS` | Gmail SMTP | Sending activation and password-reset emails. |
| `MPESA_*` | empty | See [M-Pesa paybill](#m-pesa-paybill). |

The frontend's API address is fixed when it is built: `API_URL` build argument
under Docker (default `http://localhost:8000/`), or the files in
`rental-frontend/src/environments/`.

## Tests

| Suite | How to run | What it covers |
|---|---|---|
| Backend, 19 tests | `python manage.py test app` | Balances, penalties, where payments go, credit, move-out, M-Pesa matching, expense types, login and reset-code limits, closed sign-up, protected files, quarterly rent. |
| Frontend, 49 tests | `ng test --watch=false --browsers=ChromeHeadless` | Every page and service loads; the payment dialog, arrears filters, WhatsApp numbers, document numbering, and returning to a page after login. |

Run the backend tests against a local database, never the live one: Django
creates and destroys a test database on the server it is pointed at.

## M-Pesa paybill

When switched on, a tenant who pays to your paybill or till is credited without
anyone typing the payment in. The account number the tenant enters decides where
the money goes:

1. an invoice number (`INV-12-202610-1`),
2. a unit number (`B12`) or the tenant's phone number, when exactly one active
   tenant matches,
3. anything else is kept as "Not matched" and matched by hand on the Payments
   page.

A payment is never recorded twice, even if Safaricom sends it again or it was
already typed in with the same M-Pesa code.

To switch it on:

1. Create a Daraja app at https://developer.safaricom.co.ke with the M-Pesa C2B
   product.
2. Set in the backend environment:

   ```
   MPESA_CALLBACK_TOKEN=<a long random string>
   MPESA_ENV=sandbox            # or production
   MPESA_SHORTCODE=<paybill or till number>
   MPESA_CONSUMER_KEY=<from Daraja>
   MPESA_CONSUMER_SECRET=<from Daraja>
   MPESA_CALLBACK_BASE_URL=https://<public address of the backend>
   ```

3. Restart the backend and run `python manage.py register_paybill_urls`.

The notification address contains `MPESA_CALLBACK_TOKEN`; that secret is what
stops anyone else from posting fake payments. While it is empty the addresses
answer "not found". This connection has not yet been tried against Safaricom.

## Security

- **Sign-up is closed.** Every account can see every property, so accounts are
  created by the administrator. `ALLOW_PUBLIC_SIGNUP=True` reopens registration.
- **Guessing is limited.** Five wrong passwords lock a login for 15 minutes.
  Five wrong password-reset codes cancel the code.
- **Uploaded files need a login.** Tenant ID photos are served only to signed-in
  users.
- **Secrets stay out of git.** `.env`, the database dump and uploaded files are
  ignored by git and left out of the Docker images.

## Known limitations

- **No separation between landlords.** Any account sees and can change every
  property. The system is safe for one landlord or one agency; it is not yet
  ready for several unrelated customers.
- **No roles.** A caretaker who records payments has the same rights as the
  owner.
- **Login lockout is counted per server process**, so with several workers the
  real limit is a few times higher than five.
- **Uploaded ID photos need persistent storage.** On hosts with a temporary disk
  they are lost on redeploy.
- **Older invoices** created before the balance rules were corrected may print a
  "balance brought forward" line that does not add up to the balance shown. The
  balance shown is the correct one.
- **Four reports use PostgreSQL-only queries** (payment collections, expense
  analysis, payment methods, utility revenue) and do not run on other databases.
