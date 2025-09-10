# Agent HQ - AI Browser Automation Platform

## Overview

Agent HQ is a $1 AI agent platform that provides 24-hour access to PHOENIX-7742, an AI agent capable of performing live browser automation. Users pay $1 for a 24-hour session where they can watch AI complete tasks in real-time through an interactive terminal-style interface. The platform features a dark terminal aesthetic inspired by VS Code and professional development tools.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript and Vite for fast development and building
- **UI Library**: Radix UI components with shadcn/ui styling system for consistent, accessible components
- **Styling**: Tailwind CSS with custom terminal-inspired dark theme
- **State Management**: TanStack React Query for server state management
- **Routing**: Wouter for lightweight client-side routing
- **Payment Processing**: Stripe integration with React Stripe.js components

### Backend Architecture
- **Runtime**: Node.js with Express.js server framework
- **Language**: TypeScript with ESM modules for modern JavaScript features
- **Session Management**: In-memory storage with interface for future database integration
- **Payment Processing**: Stripe webhooks and payment intent creation
- **Development**: Hot module replacement via Vite integration in development mode

### Data Storage Solutions
- **Database ORM**: Drizzle ORM configured for PostgreSQL with Neon Database serverless
- **Session Storage**: Currently using in-memory storage with `IStorage` interface for easy migration to persistent storage
- **Schema Design**: 
  - Sessions table for 24-hour agent access tracking
  - Messages table for chat history between users and agents
  - Executions table for tracking agent task performance and logs

### Authentication and Authorization
- **Payment-Based Access**: Users gain access through successful Stripe payment completion
- **Session Management**: Time-limited sessions (24 hours) with automatic expiration
- **Agent Assignment**: Unique agent IDs generated per session for isolated interactions

### External Dependencies
- **Payment Processing**: Stripe for $1 payment intents and session creation
- **Database**: Neon PostgreSQL serverless database for production data persistence
- **Fonts**: Google Fonts integration (Geist Mono, Fira Code, DM Sans) for terminal aesthetic
- **Development Tools**: Replit integration for development environment and error handling
- **Build Tools**: Vite with React plugin, ESBuild for production bundling, PostCSS for CSS processing

The architecture follows a terminal-inspired design philosophy with electric blue accents and monospace typography, creating a professional development environment feel for AI agent interactions.