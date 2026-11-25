---
name: nakshatra-ui-design
description: Expert UI/UX architecture and CSS animation guidelines for the Nakshatra AI web application. Use this skill whenever building, styling, or refining the Nakshatra AI home screen, pitch-black chat screen, Gemini-style user bubbles, Claude-style Markdown AI responses, or smooth 60fps CSS transitions.
---

# Nakshatra AI — Master UI/UX & CSS Engineering Skill

You are an expert UI/UX Engineer and Frontend Architect designing **Nakshatra AI**. Every component, transition, and typographic detail must feel effortless, modern, and silky smooth at 60fps.

## 1. Core Tech Stack & Motion Principles
- **Architecture:** Clean, semantic **HTML5**, modular **CSS3** (Custom Properties/Variables, Flexbox, Grid, `@keyframes`), and modern **Vanilla JavaScript** (unless React is explicitly specified).
- **Silky-Smooth Motion:**
  - Strictly animate GPU-composited properties (`transform`, `opacity`, `filter`)—never animate `height`, `top`, or `margin` directly.
  - Use custom spring/deceleration easing curves (`cubic-bezier(0.22, 1, 0.36, 1)`) for screen transitions, message entrances, and button interactions.
  - Subtle staggered entrance animations (`animation-delay` increments of `60ms`) for home screen cards and chat elements.

## 2. Home Screen Visual System (Cosmic Dark Theme)
Match the signature **Nakshatra AI** brand identity:
- **Canvas Background:** Deep cosmic midnight-navy gradient (`radial-gradient(circle at 50% 35%, #111842 0%, #06091c 55%, #02030a 100%)`) overlaid with a luminous blue-violet sweeping cosmic light arc behind the hero branding.
- **Top Header Bar:** Minimalist left-aligned 3-line staggered menu trigger (`#d1d5db`, smooth hover opacity).
- **Hero Branding (Always Crisp & Unfaded):**
  - Rounded-square app icon badge (`width: 68px`, `height: 68px`, `border-radius: 20px`) containing the glowing cyan-to-violet 4-point star emblem with a soft ambient outer glow (`box-shadow: 0 8px 32px rgba(99, 102, 241, 0.35)`).
  - Title **`NAKSHATRA AI`** in bold, uppercase geometric sans-serif (`letter-spacing: 0.16em`, `#ffffff`, italic emphasis on `AI`). Never fade, blur, or dim the logo or title during animations.
- **Greeting Typography:**
  - Primary greeting: **`Hello,`** (`2.4rem`, `font-weight: 700`, `#ffffff`, tight tracking `-0.02em`).
  - Secondary prompt: **`How can I help you today?`** (`1.15rem`, `font-weight: 400`, `#cbd5e1`, `margin-top: 6px`).
- **Quick Action Suggestion Cards:**
  - Full-width stacked glassmorphic cards (`border-radius: 16px`, `padding: 16px 20px`, `gap: 12px`).
  - Surface styling: `background: rgba(24, 28, 56, 0.62)`, `backdrop-filter: blur(14px)`, `border: 1px solid rgba(139, 92, 246, 0.2)`.
  - Left-aligned muted periwinkle icons (`#818cf8`) + crisp white labels (`Write something...`, `Solve a problem...`, `Give me ideas...`).
  - Interactive state: Smooth `translateY(-2px)` lift and border luminosity boost on hover/active tap.

## 3. Chat Screen & Pitch-Black AMOLED Dark Mode
- **Seamless State Transition:** When a prompt is submitted or a suggestion card is tapped, smoothly fade and slide out the Home Screen (`opacity: 0; transform: translateY(-16px) scale(0.98)`) while transitioning the viewport background to pure pitch-black.
- **Chat Surface:** Pure AMOLED black (`#000000`) background for zero eye strain and maximum contrast.
- **Scroll Container & Feather Masks:**
  - Generous vertical padding (`padding-bottom: 110px`) so the last message never hides behind the floating input bar.
  - Apply subtle top and bottom edge gradient masks strictly within the scrollable chat container boundaries—never overlapping the top header or bottom input bar.

## 4. Message Styling: Gemini User Bubbles & Claude AI Markdown

### A. User Message Bubble (Gemini-Inspired Clean Gray Pill)
- **Alignment:** Right-aligned (`align-self: flex-end`, `max-width: 80%`).
- **Surface & Color:** Soft dark neutral gray (`#1e1f22` or `#232428`) with a subtle hairline border (`1px solid rgba(255, 255, 255, 0.06)`).
- **Shape & Spacing:** Generous rounded corners (`border-radius: 22px 22px 6px 22px`), comfortable inner padding (`12px 18px`), crisp white text (`#f3f4f6`, `font-size: 0.98rem`, `line-height: 1.5`).
- **Entrance Animation:** Subtle upward fade-in (`translateY(10px)` to `0`, `280ms ease-out`).

### B. AI Response Formatting (Claude-Inspired Editorial Markdown)
AI responses must **not** sit inside heavy bordered boxes. Render them directly on the `#000000` canvas with editorial clarity, generous breathing room, and structured Markdown hierarchy:
- **Typography & Spacing:**
  - Use a clean, highly legible humanist sans-serif (`Inter`, `Plus Jakarta Sans`, or system-ui) at `1rem` (`16px`) with relaxed line-height (`1.68`) and soft off-white color (`#ececf1`) to prevent harsh glare on black.
  - Paragraph spacing: `margin-bottom: 1.1em` between paragraphs for effortless scanning.
- **Headings (`h1`, `h2`, `h3`):** Crisp pure white (`#ffffff`), `font-weight: 600`, `margin-top: 1.4em`, `margin-bottom: 0.5em`.
- **Lists & Bullet Points (`ul`, `ol`):**
  - Clean left indentation (`padding-left: 1.35em`), well-spaced list items (`margin-bottom: 0.55em`), subtle indigo/violet or muted gray bullet markers, and `<strong>` lead-ins in `#ffffff`.
- **Code Blocks & Inline Code:**
  - Inline code: Subtle dark pill (`background: #161821`, `color: #93c5fd`, `padding: 2px 6px`, `border-radius: 6px`, `font-family: 'JetBrains Mono', monospace`).
  - Multi-line code blocks: Rounded dark container (`background: #0d0e14`, `border: 1px solid #1f2230`, `border-radius: 12px`) with a top language header and a one-click **Copy** button.
- **Tables & Blockquotes:**
  - Blockquotes: Left accent border (`3px solid #6366f1`), subtle tinted background (`rgba(99, 102, 241, 0.08)`), `padding: 10px 16px`, `border-radius: 0 10px 10px 0`.
  - Clean horizontal dividers (`1px solid rgba(255, 255, 255, 0.08)`) between major sections.

## 5. Floating Bottom Input Bar & Brand Action Button
- **Container:** Floating full-pill bar (`border-radius: 9999px`, `background: #14151c`, `border: 1px solid rgba(255, 255, 255, 0.09)`, `padding: 6px 8px 6px 20px`), centered at the bottom with subtle backdrop blur.
- **Text Input:** Placeholder **`Ask Nakshatra AI...`** (`#8b90a0`), transparent background, zero browser outline on focus, smooth auto-expanding height for multi-line prompts.
- **Microphone Button:** Crisp white mic icon (`#ffffff`) positioned immediately left of the primary action button, with a subtle circular hover highlight (`rgba(255, 255, 255, 0.08)`).
- **Signature Gradient Send / Voice Button:**
  - Circular button (`44px × 44px`, `border-radius: 50%`) matching the Nakshatra AI brand gradient (`linear-gradient(135deg, #38bdf8 0%, #6366f1 50%, #a855f7 100%)`) with a soft ambient glow (`box-shadow: 0 0 18px rgba(124, 58, 237, 0.45)`).
  - **Dynamic Icon Morph:** Displays the white audio waveform + sparkle icon when the input is empty, smoothly rotating/morphing into a crisp white send arrow (`↑` or `➤`) as soon as the user types text, with a tactile `transform: scale(0.92)` press effect.

## 6. Strict Design Guardrails
- **Never** use light/white screen backgrounds or harsh gray borders.
- **Never** wrap AI responses in bulky colored bubbles—keep AI text clean and open like Claude, while keeping user messages in sleek gray pills like Gemini.
- **Never** fade out or obscure the Nakshatra AI logo or title.
- **Never** use jarring layout jumps; every state change must be smoothly animated.
