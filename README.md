# 944 TrafikTaxa - Premium Taxi Booking Platform

A modern, full-featured taxi booking platform built with Next.js, TypeScript, and multiple payment integrations. This application provides seamless ride booking, real-time tracking, and comprehensive admin management capabilities.

## 🌟 Features

### Core Features
- **Real-time Taxi Booking** - Instant ride scheduling with instant confirmations
- **Multiple Vehicle Types** - Sedans, vans, limousines with dynamic pricing
- **Transparent Pricing** - Clear day/night rates with real-time calculation
- **User Authentication** - Secure login, registration, and email verification
- **Multi-language Support** - English, Arabic, Danish (i18n ready)

### Payment Systems
- **Credit/Debit Cards** - Stripe integration with React Stripe.js
- **Cryptocurrency** - Bitcoin, Ethereum, USDT, USDC, Pi network support
- **PayPal** - Direct PayPal payment processing
- **Revolut** - Modern banking integration
- **Invoice System** - Business account invoice billing
- **Multi-currency** - Support for DKK and international currencies

### User Experience
- **Live Tracking** - Real-time GPS tracking with WebSocket connections
- **Favorites** - Save frequently used addresses
- **Complaint System** - Integrated customer feedback and resolution
- **Booking History** - Complete ride history with detailed records
- **Invoice Management** - Professional invoice generation and tracking
- **Notifications** - Real-time booking updates and confirmations

### Admin Features
- **Dashboard** - Comprehensive admin control panel
- **Booking Management** - View, modify, and cancel bookings
- **Driver Management** - Track and manage driver performance
- **Payment Oversight** - Monitor all payment transactions
- **Settings Configuration** - Dynamic pricing and company settings
- **Data Analytics** - Business intelligence and reporting
- **Complaint Resolution** - Handle customer complaints and feedback

### Technical Features
- **Progressive Web App** - PWA capabilities for mobile experience
- **Responsive Design** - Mobile-first design with Tailwind CSS
- **Real-time Updates** - WebSocket connections for live data
- **Error Handling** - Comprehensive error boundaries and monitoring
- **Security** - JWT authentication, rate limiting, input validation
- **Performance** - Server-side rendering with Next.js App Router

## 🚀 Tech Stack

### Frontend
- **Next.js 14** - React framework with App Router
- **React 18.3** - Latest React features and hooks
- **TypeScript** - Type-safe development
- **Tailwind CSS** - Utility-first CSS framework
- **SWR** - Data fetching with real-time updates

### Backend
- **Next.js API Routes** - Serverless API endpoints
- **Prisma ORM** - Database management and migrations
- **MySQL** - Primary database
- **WebSockets** - Real-time communication

### Authentication & Security
- **JWT** - JSON Web Token authentication
- **bcrypt** - Password hashing
- **Rate Limiting** - API protection
- **Input Validation** - Zod schema validation
- **Security Headers** - Comprehensive security middleware

### Payment Processing
- **Stripe** - Credit card processing
- **PayPal API** - PayPal integration
- **Crypto APIs** - Cryptocurrency support
- **Revolut API** - Banking integration

### Development & Testing
- **Jest** - Unit testing framework
- **Testing Library** - React component testing
- **Playwright** - E2E testing
- **ESLint** - Code linting
- **Prettier** - Code formatting
- **Docker** - Containerization support

## 📋 Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** 18.0 or higher
- **npm** or **yarn** package manager
- **MySQL** 8.0 or higher (or Docker)
- **Git** for version control

## 🛠️ Installation & Setup

### 1. Clone the Repository
```bash
git clone https://github.com/mosessaleh/944-TrafikTaxa.git
cd 944-TrafikTaxa
```

### 2. Install Dependencies
```bash
npm install
# or
yarn install
```

### 3. Environment Configuration
```bash
cp .env.example .env
```

Update the `.env` file with your configuration:

```env
# Authentication
AUTH_SECRET=your-super-secret-key-here-change-this
PUBLIC_BASE_URL=http://localhost:3000

# Database
DATABASE_URL=mysql://username:password@localhost:3306/944_taxi

# Email Configuration
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
FROM_EMAIL=your-email@gmail.com

# Optional: Resend Integration
RESEND_API_KEY=your-resend-api-key
RESEND_FROM=944 Trafik <no-reply@944.dk>

# Stripe (Optional for payments)
STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_SECRET_KEY=sk_test_...

# PayPal (Optional)
PAYPAL_CLIENT_ID=your-paypal-client-id
PAYPAL_CLIENT_SECRET=your-paypal-client-secret

# Cryptocurrency (Optional)
NOWNODES_API_KEY=your-nownodes-api-key

# Revolut (Optional)
REVOLUT_API_URL=https://sandbox-b2b.revolut.com
REVOLUT_CLIENT_ID=your-revolut-client-id
```

### 4. Database Setup

#### Option A: Local MySQL
```sql
CREATE DATABASE 944_taxi;
```

#### Option B: Docker
```bash
# Using Docker directly
docker run --name 944-taxi-mysql -e MYSQL_ROOT_PASSWORD=root -e MYSQL_DATABASE=944_taxi -p 3306:3306 -d mysql:8.0

# Using Docker Compose
docker-compose up -d mysql
```

### 5. Database Migration
```bash
# Apply database schema
npx prisma migrate dev --name init

# Generate Prisma Client
npx prisma generate

# Optional: Open Prisma Studio
npx prisma studio
```

### 6. Seed Data (Optional)
```bash
# Create test data
node scripts/create-test-user.js
node scripts/create-vehicle-type-4.js
node scripts/create-test-ride-13.js
node scripts/create-test-invoice.js
node scripts/update-test-invoice.js
```

### 7. Start Development Server
```bash
npm run dev
# or
yarn dev
```

Visit [http://localhost:3000](http://localhost:3000) to see the application.

## 📖 API Documentation

### Authentication Endpoints
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `POST /api/auth/logout` - User logout
- `GET /api/auth/me` - Get current user
- `POST /api/auth/verify` - Verify email
- `POST /api/auth/request-reset` - Request password reset
- `POST /api/auth/reset` - Reset password

### Booking Endpoints
- `GET /api/quote` - Get ride pricing quote
- `POST /api/bookings` - Create new booking
- `GET /api/bookings` - Get user bookings
- `GET /api/bookings/[id]` - Get specific booking
- `PATCH /api/bookings/[id]/cancel` - Cancel booking

### Payment Endpoints
- `GET /api/payments/methods` - Get available payment methods
- `POST /api/payments/quote` - Get payment quote
- `POST /api/payments/card/create` - Create Stripe payment
- `POST /api/payments/crypto/confirm` - Confirm crypto payment
- `POST /api/payments/paypal/create` - Create PayPal payment
- `POST /api/payments/revolut/create` - Create Revolut payment

### Admin Endpoints
- `GET /api/admin/bookings` - Get all bookings (admin)
- `GET /api/admin/users` - Get all users (admin)
- `GET /api/admin/invoices` - Get all invoices (admin)
- `GET /api/admin/settings` - Get system settings
- `PATCH /api/admin/settings` - Update system settings

### User Management
- `GET /api/profile` - Get user profile
- `PATCH /api/profile` - Update profile
- `GET /api/favorites` - Get favorite addresses
- `POST /api/favorites` - Add favorite address
- `DELETE /api/favorites/[id]` - Remove favorite

### Real-time Features
- `WebSocket /api/realtime` - Real-time updates and tracking

## 🎯 Usage Examples

### Creating a New Booking
```javascript
// Frontend usage with SWR
const { data, error } = useSWR('/api/quote', {
  method: 'POST',
  body: JSON.stringify({
    from: pickupAddress,
    to: dropoffAddress,
    vehicleType: 'SEDAN5',
    scheduled: false,
    pickupTime: new Date().toISOString()
  })
});
```

### Processing Payments
```javascript
// Stripe payment example
const handleCardPayment = async (bookingId, paymentMethod) => {
  const response = await fetch('/api/payments/card/create', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      bookingId,
      paymentMethod
    })
  });
  
  const { clientSecret } = await response.json();
  // Use clientSecret with Stripe Elements
};
```

### Real-time Tracking
```javascript
// WebSocket connection for live tracking
import { useRealtime } from '@/components/RealtimeProvider';

const { subscribeToBooking, currentLocation } = useRealtime();

// Subscribe to booking updates
useEffect(() => {
  subscribeToBooking(bookingId);
}, [bookingId]);
```

## 🧪 Testing

Run the test suite:

```bash
# Unit tests
npm run test

# Watch mode
npm run test:watch

# Coverage report
npm run test:coverage

# E2E tests (requires setup)
npm run test:e2e
```

## 🐳 Docker Deployment

```bash
# Build and run with Docker Compose
docker-compose up -d

# Production build
docker-compose -f docker-compose.prod.yml up -d
```

## 🔧 Configuration

### Environment Variables
| Variable | Description | Required |
|----------|-------------|----------|
| `DATABASE_URL` | MySQL connection string | ✅ |
| `AUTH_SECRET` | JWT secret key | ✅ |
| `PUBLIC_BASE_URL` | Application base URL | ✅ |
| `SMTP_*` | Email configuration | ✅ |
| `STRIPE_*` | Stripe payment keys | ❌ |
| `PAYPAL_*` | PayPal configuration | ❌ |
| `RESEND_API_KEY` | Resend email service | ❌ |

### System Settings
The application includes a settings model for business configuration:

```javascript
// Settings can be updated via admin panel or API
{
  "brandName": "944 Trafik",
  "contactEmail": "trafik@944.dk",
  "contactPhone": "26444944",
  "addressCity": "Frederikssund",
  "dayBase": 40,
  "dayPerKm": 12.75,
  "dayPerMin": 5.75,
  "nightBase": 60,
  "nightPerKm": 16,
  "nightPerMin": 7,
  "workStart": "06:00",
  "workEnd": "18:00"
}
```

## 🚀 Deployment

### Vercel (Recommended)
```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel --prod
```

### Manual Deployment
```bash
# Build for production
npm run build

# Start production server
npm start
```

### Environment Setup for Production
1. Set all required environment variables
2. Configure production database
3. Set up SSL certificates
4. Configure reverse proxy (nginx)
5. Set up monitoring and logging

## 🤝 Contributing

We welcome contributions! Please follow these steps:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Development Guidelines
- Follow TypeScript best practices
- Write comprehensive tests
- Use meaningful commit messages
- Update documentation for new features
- Follow ESLint and Prettier configurations

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support & Troubleshooting

### Common Issues

**Database Connection Error:**
```bash
# Check if MySQL is running
systemctl start mysql  # Linux
brew services start mysql  # macOS

# Verify DATABASE_URL
echo $DATABASE_URL
```

**Prisma Errors:**
```bash
# Regenerate Prisma Client
npx prisma generate
npx prisma db push
```

**Missing Dependencies:**
```bash
# Clean install
rm -rf node_modules package-lock.json
npm install
```

### Getting Help
- Check the [Wiki](wiki) for detailed guides
- Open an [Issue](issues) for bug reports
- Join our [Discord](discord) for community support

## 🎉 Acknowledgments

- Next.js team for the amazing framework
- Prisma team for the excellent ORM
- Stripe for payment processing
- All contributors and testers

---

**Built with ❤️ by the 944 Trafik Development Team**

For more information, visit our [website](https://944.dk) or contact us at [trafik@944.dk](mailto:trafik@944.dk).