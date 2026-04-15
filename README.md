# AI Provider Management

AgenticVR AI Provider Management System - Multi-tenant AI service provider configuration and management platform.

## Features

- 🔑 Multi-key API management (LLM, STT, TTS)
- 🔄 Key rotation strategies (round_robin, fallback, least_used)
- 💰 Cost intelligence and financial tracking
- 🎙️ Voice studio for TTS voice selection
- 📊 Comprehensive analytics and audit logging
- 🔐 Multi-tenant isolation and security
- 📧 Email association with API keys

## Tech Stack

- **Frontend**: Next.js 14 + React 18 + TypeScript
- **3D Graphics**: Three.js + React Three Fiber
- **Styling**: Tailwind CSS
- **Database**: PostgreSQL (Neon)
- **Hosting**: Vercel
- **Domain**: aidemo.oneviewsolutions.com

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn
- PostgreSQL database (Neon)

### Installation

```bash
npm install
```

### Environment Variables

Create a `.env.local` file:

```
DATABASE_URL=postgresql://...
DATABASE_URL_UNPOOLED=postgresql://...
```

### Development

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Build

```bash
npm run build
npm start
```

## Project Structure

```
├── app/
│   ├── layout.tsx          # Root layout
│   ├── page.tsx            # Home page
│   └── globals.css         # Global styles
├── components/
│   └── Scene.tsx           # 3D scene component
├── package.json
├── tsconfig.json
├── tailwind.config.ts
├── next.config.js
└── vercel.json
```

## Deployment

### Deploy to Vercel

1. Push to GitHub
2. Connect repo to Vercel
3. Add environment variables
4. Deploy

### Configure Custom Domain

1. Add `aidemo.oneviewsolutions.com` in Vercel dashboard
2. Update DNS records at domain registrar
3. Wait for DNS propagation

## Spec Documentation

See `.kiro/specs/ai-provider-management/` for detailed requirements and design documents.

## License

Proprietary - OneView Solutions
