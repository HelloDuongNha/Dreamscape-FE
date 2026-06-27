# **PROJECT_SPEC.md: DREAMSCAPE TECHNICAL SPECIFICATIONS**

## **1. PROJECT OVERVIEW**
* **Project Name:** DreamScape
* **Vision:** A hybrid Social Network and AI Dream platform with a clean, high-end flat interface.
* **Architecture:** **Feature-Driven Component Architecture (FDCA)**.
* **Design Pattern:** **Atomic Design System** (Atoms, Molecules, Organisms).
* **Tech Stack:** Vue 3 (Vite), TypeScript, Pinia, Scoped CSS (No heavy UI frameworks).

## **2. DESIGN SYSTEM & UI/UX RULES (THREADS-STYLE)**
* **Theme:** Pure Flat Dark Mode (Inspired directly by threads.com).
* **Backgrounds:** Strictly **Solid Colors**. Main background must be solid black/dark-gray (`#101010`).
* **Visual Constraints:** **ABSOLUTELY NO GRADIENTS, NO BACKDROP-BLUR, NO GLASSMORPHISM**. 
* **Borders:** Separations must use ultra-thin borders (1px solid `#262626`) instead of shadows or color blocks.
* **Typography:** Pure white (`#F3F5F7`) for headings, soft gray (`#616161`) for descriptions and metadata.
* **Styling:** Strictly use **Scoped CSS** mapping to the standard variables in `variables.css`.

## **3. DIRECTORY STRUCTURE (FDCA)**
```text
src/
├── assets/styles/      # Global CSS & Flat Variables
├── components/common/  # Atomic UI (AppButton, AppInput, AppCard)
├── layouts/            # Sidebar.vue, MainLayout.vue
├── features/           # Modular features
│   ├── home/           # Search bar, Post Composer, Flat Feed
│   ├── messages/       # Chat List, Search @username, Messenger-style Window
│   ├── profile/        # User Archive, Profile Logic
│   └── oracle/         # Coming Soon Landing (Flat design)
├── store/              # Pinia state management
├── data/               # Mock data files (Source of truth for demo)
└── router/             # Vue Router config

4. FUNCTIONAL REQUIREMENTS (FR)
FR01: Global Navigation (Sidebar)
•	Layout: Fixed to the left, slim width, flat background (#101010).
•	Items: Icons only (Home, Messages, Notifications, Profile, Oracle).
•	Logic: Active icons change from muted gray to pure white. No neon glows. No search bar here.
FR02: Home Page (The Social Hub)
•	Global Search: Facebook/Threads-style solid input bar at the top to search posts/users.
•	Post Composer: Flat container where users type dreams, select Public/Private toggle, and hit "Post".
•	Dream Feed: Flat cards using AppCard.vue with 1px borders. No gradients inside cards.
•	Oracle Placeholder: A clean, flat boxed area inside the card labeled "AI Oracle Status: Sensing..." using muted gray text.
FR03: Messenger-style Messaging
•	Layout: Dual-pane layout matching Messenger/Threads web.
•	Chat Sidebar: List of conversations. Search bar at the top to filter/find users by typing @username.
•	Chat Window: Solid message bubbles (Me: Solid clean white or blue, Text color adapts; Others: Solid dark gray #262626).
•	Integration: Clicking "Message" on a user's profile routes to this view and opens their specific chat instantly.
FR04: AI Oracle Logic (Phase 2 - Placeholder)
•	Current State: A clean "Coming Soon" landing page with a solid flat background and minimalist typography.
FR05: Personal Archive & Export
•	Archive: Flat timeline layout displaying the user's logged dreams.
•	Export: Minimalist button to trigger a template download.
5. NON-FUNCTIONAL REQUIREMENTS (NFR)
•	NFR01: Smoothness: 60fps native scrolling. Flat layouts eliminate rendering bottlenecks caused by heavy CSS filters (blur/gradients).
•	NFR02: Scalability: Architecture ready for high concurrency (MongoDB indexing on username, createdAt).
•	NFR03: Maintainability: 100% strict TypeScript types for data structures.

## **6. DATA SCHEMA & MOCK DATA (SOURCE OF TRUTH)**
Mọi Mock Data phải tuân thủ nghiêm ngặt các trường (fields) sau để sẵn sàng cho MongoDB & API sau này.

### **6.1. User Object (Users Collection)**
- `_id`: string (uuid)
- `username`: string (e.g., "@helloduongnha")
- `display_name`: string
- `avatar`: string (url)
- `bio`: string
- `follower_count`: number

### **6.2. Dream Object (Dreams Collection)**
- `_id`: string (uuid)
- `userId`: string (foreign key to User._id)
- `content`: string
- `mood_tag`: string (e.g., "Lucid", "Nightmare", "Calm")
- `is_public`: boolean
- `likes_count`: number
- `comments_count`: number
- `created_at`: string (ISO 8601)
- `ai_status`: string (e.g., "pending", "sensing", "completed")
- `ai_result`: object | null (placeholder for Phase 2)

### **6.3. Conversation Object (Conversations Collection)**
- `_id`: string (uuid)
- `participant_ids`: string[] (array of User._id)
- `last_message`: string
- `updated_at`: string (ISO 8601)

### **6.4. Message Object (Messages Collection)**
- `_id`: string (uuid)
- `conversationId`: string (foreign key to Conversation._id)
- `senderId`: string (foreign key to User._id)
- `content`: string
- `timestamp`: string (ISO 8601)

### **6.5. Comment Object (Comments Collection)**
- `_id`: string (uuid)
- `postId`: string (foreign key to Dream._id)
- `userId`: string (foreign key to User._id)
- `content`: string
- `timestamp`: string (ISO 8601)

### **6.6. UI States & Loading (Skeleton Spec)**
- **Skeleton Color:** Solid Dark Gray (`#262626`) for background, pulsing with a slightly lighter gray (`#333333`).
- **Logic:** Every feature (Home, Messages, Profile) must have a corresponding Skeleton view.
- **Duration:** 1s artificial delay for demo purposes (using `setTimeout`).
- **Transition Mode:** Use `<Transition mode="out-in">` for all route changes to prevent Layout Shift.

## **7. REAL-TIME CHAT SPECIFICATION (SOCKET.IO)**
- **Protocol:** WebSockets via `socket.io` (v4+).
- **Authentication:** Socket connection must handshake using the same JWT Bearer Token.
- **Events:**
  - `connection`: Client connects, joins a personal room named after their `userId`.
  - `join_room`: Client enters a specific `conversationId` view.
  - `send_message`: Client sends message payload -> Server saves to DB -> Server emits `receive_message` to the recipient's room.
  - `disconnect`: Clean up client state.