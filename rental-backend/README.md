# Rental Management Backend

Django backend for a rental management system.

## Project Overview

This project provides backend APIs for managing properties, tenants, rent, and payments.

## Screenshots

### System Architecture
![architecture](./images/architecture.png)

### API Flow
![api-flow](./images/api-flow.png)

### Database Diagram
![database-diagram](./images/database-diagram.png)

(Add your actual images in an /images/ folder)

## Installation

Clone the repository:
```
git clone https://github.com/dennis027/rental-managment-backend.git
cd rental-managment-backend
```

Create a virtual environment:
```
python3 -m venv venv
source venv/bin/activate
```

Install dependencies:
```
pip install -r requirements.txt
```

Run migrations:
```
python manage.py migrate
```

Start server:
```
python manage.py runserver
```

## Environment Variables

Create a .env file for database credentials and other settings.

## Project Structure

```
manage.py
requirements.txt
app/
projects/
images/
```

## Usage

Default local API URL:
```
http://127.0.0.1:8000/
```

## Notes

Update settings before running the project.



## M-Pesa paybill (automatic payments)

When this is switched on, a tenant who pays to your paybill or till is credited
automatically and the payment appears under Payments > M-Pesa paybill.

The account number the tenant types decides where the money goes:

1. an invoice number (`INV-12-202610-1`) pays that invoice;
2. a unit number (`B12`) or the tenant's phone number pays the latest unpaid
   invoice of that tenant, provided exactly one active tenant matches;
3. anything else is kept as "Not matched" and is matched by hand on the same page.

A payment is never recorded twice, even if Safaricom sends it again or it was
already entered by hand with the same M-Pesa code.

### Switching it on

1. Create a Daraja app at https://developer.safaricom.co.ke with the
   "M-Pesa C2B" product and note its consumer key and secret.
2. Set these in the backend environment (`.env`):

   ```
   MPESA_CALLBACK_TOKEN=<a long random string, e.g. from `openssl rand -hex 24`>
   MPESA_ENV=sandbox            # or production
   MPESA_SHORTCODE=<your paybill or till number>
   MPESA_CONSUMER_KEY=<from Daraja>
   MPESA_CONSUMER_SECRET=<from Daraja>
   MPESA_CALLBACK_BASE_URL=https://<public address of this backend>
   ```

   The callbacks stay switched off (404) while `MPESA_CALLBACK_TOKEN` is empty.
3. Restart the backend, then tell Safaricom where to send payments:

   ```
   python manage.py register_paybill_urls
   ```

Safaricom calls `/api/paybill/<MPESA_CALLBACK_TOKEN>/confirmation/`. The token
in the address is what stops anyone else from posting fake payments, so keep it
secret. The backend must be reachable over https.

## Unit balances

Run `python manage.py recalculate_balances` once after upgrading. Older versions
counted the balance brought forward on each invoice as a new charge, which
inflated the stored balance of units with unpaid invoices.
