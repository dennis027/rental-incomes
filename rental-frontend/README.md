# Rental Management Frontend

React frontend for a rental management system.

## Project Overview

This project provides a web interface for managing properties, tenants, units, rent receipts, payments, and maintenance requests.

## Screenshots

### Dashboard
![dashboard](./src/assets/images/dashboard.png)

### Receipt Generation
![receipt-generation](./images/receipt-generation.png)

### Payment Tracking
![payment-tracking](./images/payment-tracking.png)

(Add your actual images in an /images/ folder)

## Installation

Clone the repository:
```
git clone https://github.com/dennis027/rental-managment.git
cd rental-management-frontend
```

Install dependencies:
```
npm install
```

Create environment file:
```
cp .env.example .env
```

Update .env with your backend API URL:
```
REACT_APP_API_URL=http://localhost:8000/api
```

Start development server:
```
npm start
```

## Environment Variables

Create a .env file:
```
REACT_APP_API_URL=http://localhost:8000/api
REACT_APP_ENV=development
```

## Project Structure
```
src/
  components/
  pages/
  services/
  context/
  hooks/
  utils/
  assets/
public/
images/
```

## Usage

Default local URL:
```
http://localhost:3000
```

## Build for Production
```
npm run build
```

## Notes

Update API URL in .env before running the project.