# Construction Workshop ERP System

A comprehensive Enterprise Resource Planning (ERP) system designed for construction workshop management. Built with Next.js 16, Prisma, and modern web technologies.

## 🚀 Features

### Core Modules (Phase 1-3)
- **Multi-Tenant Architecture** - Support for multiple companies with isolated data
- **Authentication & Authorization** - JWT-based auth with role-based access control
- **Asset Management** - Track equipment, machinery, and vehicles with QR codes
- **Item Master** - Parts catalog with categorization and specifications
- **Store Management** - Multi-location inventory tracking
- **Job/Work Order Management** - Create, assign, and track maintenance jobs
- **Item Requests** - Request parts with approval workflow
- **Stock Management** - FIFO-based inventory with real-time tracking
- **Parts Returns** - Process returned items efficiently
- **Fuel Management** - Track fuel consumption and costs
- **Safety Enforcement** - Alerts and compliance tracking
- **Audit Logging** - Complete activity history
- **Mobile App** - Technician interface with offline sync

### Advanced Modules (Phase 4)
- **Preventive Maintenance (PM) Engine** - Auto-schedule maintenance based on meter readings
- **Downtime & Availability Tracking** - Monitor equipment availability with traffic light view
- **MIS & Reporting** - Executive dashboard with KPIs and TCO reports
- **External Repair Integration** - Gate pass management for outside repairs

### Production Ready Features
- **Error Handling** - Trace ID-based error tracking
- **Input Validation** - Comprehensive validators and sanitizers
- **Maintenance Mode** - System-wide maintenance toggle
- **Health Monitoring** - System health check endpoints
- **Data Migration Tools** - Bulk import for Assets/Items/Users/Stock

## 📋 Requirements

- **Node.js** >= 18.x or **Bun** >= 1.0
- **SQLite** (included) or PostgreSQL/MySQL

## 🛠️ Installation

### Quick Start

```bash
# Clone the repository
git clone https://github.com/yohan114/Construction-Workshop-ERP.git
cd Construction-Workshop-ERP

# Install dependencies (using Bun - recommended)
bun install

# Setup database and seed test data
bun run db:setup

# Start development server
bun run dev
```

### Using npm/yarn

```bash
# Install dependencies
npm install
# or
yarn install

# Setup database
npm run db:push
npm run db:seed

# Start development server
npm run dev
```

## 📦 Dependencies

### Core Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| `next` | ^16.1.1 | React framework with App Router |
| `react` | ^19.0.0 | UI library |
| `prisma` | ^6.11.1 | ORM for database |
| `@prisma/client` | ^6.11.1 | Prisma client |

### UI Components (shadcn/ui + Radix)

| Package | Version | Purpose |
|---------|---------|---------|
| `@radix-ui/react-*` | Various | Accessible UI primitives |
| `lucide-react` | ^0.525.0 | Icon library |
| `recharts` | ^2.15.4 | Charts and visualizations |
| `framer-motion` | ^12.23.2 | Animations |
| `class-variance-authority` | ^0.7.1 | Component variants |
| `tailwind-merge` | ^3.3.1 | Tailwind class utilities |

### State & Data Management

| Package | Version | Purpose |
|---------|---------|---------|
| `zustand` | ^5.0.6 | Client state management |
| `@tanstack/react-query` | ^5.82.0 | Server state management |
| `@tanstack/react-table` | ^8.21.3 | Data tables |

### Forms & Validation

| Package | Version | Purpose |
|---------|---------|---------|
| `react-hook-form` | ^7.60.0 | Form handling |
| `zod` | ^4.0.2 | Schema validation |
| `@hookform/resolvers` | ^5.1.1 | Form resolvers |

### Utilities

| Package | Version | Purpose |
|---------|---------|---------|
| `date-fns` | ^4.1.0 | Date utilities |
| `uuid` | ^11.1.0 | UUID generation |
| `next-themes` | ^0.4.6 | Theme management |
| `sonner` | ^2.0.6 | Toast notifications |

### Development Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| `typescript` | ^5 | Type safety |
| `tailwindcss` | ^4 | CSS framework |
| `eslint` | ^9 | Code linting |
| `bun-types` | ^1.3.4 | Bun type definitions |

## 🔧 Available Scripts

| Script | Command | Description |
|--------|---------|-------------|
| `dev` | `bun run dev` | Start development server on port 3000 |
| `build` | `bun run build` | Build for production |
| `start` | `bun run start` | Start production server |
| `lint` | `bun run lint` | Run ESLint |
| `db:push` | `bun run db:push` | Push schema to database |
| `db:generate` | `bun run db:generate` | Generate Prisma client |
| `db:migrate` | `bun run db:migrate` | Create and run migrations |
| `db:reset` | `bun run db:reset` | Reset database |
| `db:seed` | `bun run db:seed` | Seed test data |
| `db:setup` | `bun run db:setup` | Push schema + seed data |

## 👤 Test Accounts

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@example.com | admin123 |
| Supervisor | supervisor@example.com | admin123 |
| Technician | technician1@example.com | admin123 |
| Storekeeper | storekeeper@example.com | admin123 |

## 📁 Project Structure

```
├── prisma/
│   ├── schema.prisma      # Database schema
│   └── seed.ts            # Seed data script
├── src/
│   ├── app/               # Next.js App Router pages
│   │   ├── api/           # API routes
│   │   ├── assets/        # Asset management
│   │   ├── jobs/          # Job management
│   │   ├── pm/            # Preventive maintenance
│   │   ├── reports/       # Reports
│   │   └── ...
│   ├── components/        # React components
│   │   ├── ui/            # shadcn/ui components
│   │   └── layout/        # Layout components
│   ├── lib/               # Utility libraries
│   │   ├── auth/          # Authentication
│   │   ├── pm-engine.ts   # PM scheduling
│   │   └── ...
│   ├── contexts/          # React contexts
│   └── hooks/             # Custom hooks
├── db/                    # SQLite database files
└── package.json
```

## 🔐 Environment Variables

Create a `.env` file in the root directory:

```env
# Database
DATABASE_URL="file:./db/custom.db"

# JWT Secret (change in production!)
JWT_SECRET="your-super-secret-key-change-in-production"

# App URL
NEXT_PUBLIC_APP_URL="http://localhost:3000"
```

## 🌐 API Endpoints

### Authentication
- `POST /api/auth/login` - User login
- `POST /api/auth/logout` - User logout
- `POST /api/auth/refresh` - Refresh access token
- `GET /api/auth/me` - Get current user

### Assets
- `GET /api/assets` - List assets
- `POST /api/assets` - Create asset
- `GET /api/assets/:id` - Get asset details
- `PUT /api/assets/:id` - Update asset
- `DELETE /api/assets/:id` - Delete asset

### Jobs
- `GET /api/jobs` - List jobs
- `POST /api/jobs` - Create job
- `GET /api/jobs/:id` - Get job details
- `PUT /api/jobs/:id` - Update job
- `PATCH /api/jobs/:id/status` - Update job status
- `POST /api/jobs/:id/cost` - Add cost entry

### Stock
- `GET /api/stock` - List stock
- `POST /api/stock` - Add stock
- `PATCH /api/stock` - Adjust stock

### Reports
- `GET /api/reports` - Get various reports

### System
- `GET /api/system/health` - Health check
- `GET /api/system/maintenance` - Maintenance status
- `POST /api/system/import` - Bulk data import

## 📱 Mobile App

Access the mobile technician interface at `/mobile`:
- View assigned jobs
- Request parts
- Update job status
- Scan QR codes
- Offline support

## 🏗️ Database Schema

Key models:
- **Company** - Multi-tenant support
- **User** - Users with roles (ADMIN, MANAGER, SUPERVISOR, TECHNICIAN, STOREKEEPER)
- **Asset** - Equipment and machinery
- **Item** - Parts and consumables
- **Store** - Storage locations
- **Stock** - Inventory tracking
- **Job** - Work orders
- **ItemRequest** - Parts requests
- **PMSchedule** - Preventive maintenance schedules
- **DowntimeLog** - Equipment downtime records
- **ExternalRepair** - Outside repair tracking

## 📄 License

MIT License

## 👥 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📞 Support

For support, please open an issue on GitHub.
