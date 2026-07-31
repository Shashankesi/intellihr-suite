## One important note on the stack

This platform runs **React + TanStack Start** with **Lovable Cloud** (managed Postgres, auth, storage, serverless functions) and **Lovable AI** for AI features. MongoDB/Express/Mongoose/Nodemailer/Cloudinary cannot run here.

Everything you asked for is still buildable — the mapping is:

| You asked | We build with |
|---|---|
| Express + Mongoose + MongoDB | Server functions + Postgres (Lovable Cloud) |
| JWT + bcrypt | Cloud Auth (JWT sessions, hashed passwords, refresh tokens) |
| Role-based access | Postgres row-level security + `user_roles` table |
| Cloudinary | Cloud Storage buckets (avatars, resumes, docs) |
| OpenAI / Gemini | Lovable AI Gateway (same models, no API key needed) |
| Nodemailer | Auth emails built in; transactional email via a provider key later |

Frontend stays exactly as specified: React, Vite, Tailwind, Framer Motion, React Query, React Hook Form, Recharts, Axios-style service layer.

## Design direction

Stripe/Linear/Vercel-grade: dark-first with light mode, glassmorphic surfaces, gradient stat cards, restrained micro-animations, page transitions, skeleton loaders, professional type scale. All colors as semantic tokens — no ad-hoc styling.

## Build order

**Phase 1 — Foundation + Landing + Auth**
- Design system (tokens, dark/light, gradients, glass, motion primitives)
- Landing page: animated hero, features, AI showcase, stats, testimonials, pricing, about/contact, footer
- Cloud enabled; auth: signup, login, email verification, forgot/reset password, remember me, protected routes, auto-logout
- Roles: `admin` / `hr` / `employee` via secure roles table

**Phase 2 — Core data + shells**
- Schemas: profiles, employees, departments, attendance, leaves, payroll, performance, notifications, documents, audit_logs (+ RLS and grants)
- Three role dashboards, app shell, sidebar, command palette, keyboard shortcuts
- Reusable table/modal/form/chart/skeleton components

**Phase 3 — HR modules**
- Employees: CRUD, search, filters, avatar upload, profile pages, CSV/PDF export
- Departments: CRUD, heads, analytics
- Attendance: clock in/out, calendar, monthly view, late/hours
- Leave: apply/approve/reject, balances, types, history

**Phase 4 — Payroll + Performance**
- Salary, payslip generation + PDF, tax/bonus, history
- Ratings, reviews, goals, monthly reports

**Phase 5 — AI layer** (all server-side, streaming where useful)
- HR Assistant, smart natural-language employee search, resume analyzer, performance summaries, attendance insights, leave classifier, email generator, policy assistant (document Q&A), dashboard assistant, report generator

**Phase 6 — Polish + hardening**
- Notifications (realtime + in-app), audit trail, settings, security review, responsive pass, empty/loading/error states everywhere

## Technical notes

- Server logic in typed server functions (validated with Zod), organized in a service layer; RLS enforces role access at the database, not just the UI.
- AI calls run only on the server; prompts and keys never reach the browser.
- Folder structure mirrors your intent: `components/`, `pages`(routes)`/`, `hooks/`, `layouts/`, `services/`, `lib/ai/`, `utils/`.

I'll build phase by phase, checking in after each so you can steer.
