# Design Guidelines for Agent HQ

## Design Approach
**Reference-Based Approach**: Drawing inspiration from modern SaaS platforms like Linear, Notion, and Stripe Dashboard. This utility-focused platform requires clean, professional aesthetics that convey trust and efficiency.

## Core Design Elements

### Color Palette
**Primary Brand Colors:**
- Dark Mode: Deep blue-gray (220 15% 12%) with bright accent (210 100% 60%)
- Light Mode: Clean whites with professional blue (210 50% 45%)

**Supporting Colors:**
- Success states: Green (142 69% 58%) for payment confirmations
- Warning states: Amber (45 93% 58%) for usage limits
- Error states: Red (0 72% 51%) for failed operations

### Typography
**Font Stack:** Inter via Google Fonts
- Headers: 600-700 weight for strong hierarchy
- Body: 400-500 weight for readability
- Code/Technical: JetBrains Mono for agent logs

### Layout System
**Spacing Primitives:** Tailwind units of 2, 4, 6, 8, and 12
- Consistent 8-unit grid system
- Generous whitespace for professional feel
- Dense information areas use 4-unit spacing

### Component Library

**Navigation:**
- Clean sidebar with collapsible sections
- Top bar with user profile and notifications
- Breadcrumb navigation for deep pages

**Dashboard Elements:**
- Card-based layout for agent status
- Real-time indicators with subtle animations
- Progress bars for task completion
- Live browser preview windows

**Payment Interface:**
- Prominent "$1 for 24 hours" pricing display
- Stripe-integrated payment forms
- Clear usage timers and status indicators

**Agent Controls:**
- Task queue interface with drag-drop capability
- Live browser automation viewer
- Agent conversation interface with chat-like design
- Emergency stop/pause controls

### Key Design Principles
1. **Trust & Security**: Professional color scheme, clear payment flows
2. **Real-time Clarity**: Live status indicators, progress visualization
3. **Operational Efficiency**: Quick access to controls, minimal clicks
4. **Transparency**: Clear usage tracking, visible agent activities

### Images
**Hero Section:** Medium-sized hero (40vh) showing browser automation in action - split screen with code/interface on left, live browser on right. Clean, technical aesthetic.

**Dashboard Screenshots:** Smaller contextual images showing agent workflows, placed inline with feature descriptions.

**No decorative imagery** - focus on functional screenshots and interface previews that demonstrate platform capabilities.