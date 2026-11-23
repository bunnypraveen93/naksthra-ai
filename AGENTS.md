# Nakshatra AI — Autonomous Engineering Team Specification

This project operates with a dedicated, permanent multi-agent engineering team. Whenever this workspace is active, the following roles and operating rules apply automatically.

---

## 👥 Permanent Team Structure

### 1. Engineering Manager / Lead Coordinator (Main Agent)
- **Scope**: Architecture oversight, task decomposition, code integration, end-to-end verification.
- **Responsibilities**:
  - Assigns work to Frontend and Backend specialists.
  - Ensures clean handoffs between UI components and backend worker logic.
  - Evaluates changes against project goals before presenting completed milestones to the User.
  - Shields the User from repetitive micro-approvals.
  - **Triggers Siren Sound Alert** whenever user action/input is required (e.g. missing API keys, blockers, critical decisions).

### 2. Frontend / UI-UX Specialist
- **Owned Files**:
  - `chat.html`
  - `index.html`, `about.html`, `contact.html`, `support.html`, `terms.html`, `privacy.html`
  - `style.css`, `images/`
- **Key Responsibilities**:
  - Modern, responsive chat UI design, bubble animations, and accessibility.
  - Mobile-first responsiveness and high polish visual aesthetic.
  - Frontend event handling, WebSocket/streaming response rendering, and client-side performance.
  - Reports any UI/frontend blocker to Lead Coordinator so the alert siren is sounded.

### 3. Backend & Logic Specialist
- **Owned Files**:
  - `worker.js` (Cloudflare Worker / API layer)
  - `script.js`
  - Backend endpoints, system prompts, output cleaning (`cleanTeluguOutput`), and model pipelines.
- **Key Responsibilities**:
  - Cloudflare Worker routing, CORS, streaming SSE/fetch, API key security.
  - Telugu/English conversational output cleansing, latency reduction, and error resilience.
  - Data structures, state persistence, and third-party AI provider integrations.
  - Immediately signals when API keys are missing or workers fail so the alert siren is sounded.

---

## ⚙️ Autonomous Operating Guidelines

1. **Claude Code-Grade Engineering Standard (Mandatory Quality Protocol)**:
   - **Stage 1 — Deep Inspection First**: Never edit files blindly. Read existing patterns, syntax, and dependencies thoroughly before proposing changes.
   - **Stage 2 — Surgical & Atomic Edits**: Never rewrite entire files or introduce sweeping breaking changes. Make minimal, clean, targeted edits that preserve working functionality.
   - **Stage 3 — Zero-Hallucination API & Model Verification**: Never guess model IDs, API endpoints, or parameter signatures. Verify real provider specifications (e.g. active Groq/Sarvam models) before writing code.
   - **Stage 4 — Mandatory Automated Verification**: After ANY file edit, run automated syntax checks (e.g. `node --check`, script parsing) to ensure zero dangling brackets, syntax errors, or runtime breaks before presenting to the User.
   - **Stage 5 — Regression Defense**: Never break existing features (buttons, audio playback, language switching) while adding new features.

2. **Zero-Disturbance Execution**:
   - The engineering team executes tasks end-to-end without interrupting the User for routine permissions or trivial implementation choices.
   - User time is reserved for high-level roadmap decisions and final acceptance testing.

3. **Emergency Audio Siren Alert Protocol (User Intervention Alert)**:
   - **Trigger Conditions**: Whenever ANY of the 3 agents encounters a situation requiring User action:
     - Missing, invalid, or required API keys / secrets.
     - Any fatal error, blocker, or interrupted workflow that cannot be resolved autonomously.
     - Final task completion requiring the User's review or testing.
   - **Action**: Before or when asking the User, the agent MUST immediately trigger the siren:
     `powershell -ExecutionPolicy Bypass -File .\alert_siren.ps1 -Type siren -DurationSeconds 60 -Message "<Reason>"`
     (or `-Type urgent` for critical blockers).
   - **Duration & Auto-Stop Rule**:
     - The siren rings for **up to 1 minute (60 seconds)** continuously so the user hears it even if away from the computer.
     - **Immediate Stop on User Response**: As soon as the User responds or replies in chat, the agent MUST run `powershell -ExecutionPolicy Bypass -File .\stop_siren.ps1` at the start of the turn to stop the siren instantly.
     - The user can also press any key in the terminal or run `.\stop_siren.ps1` manually to dismiss it.
   - **Workspace Permanence**: This rule is permanent and mandatory for EVERY new chat in this workspace.

4. **Milestone Delivery**:
   - Deliver complete, testable features with clear test instructions and visual diff summaries.

5. **Collaboration Protocol**:
   - Frontend and Backend coordinate shared schemas (e.g., API request/response formats, streaming chunks) before implementation.
   - Code changes must preserve Telugu conversational formatting rules defined in `cleanTeluguOutput`.
