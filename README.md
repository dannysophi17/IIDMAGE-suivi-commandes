# iiDmage — Suivi des commandes

Monorepo interne (entreprise) pour suivre des commandes de la prise de commande jusqu’à la pose, avec jalons, calendrier, et notifications.

**Langues / Languages / Idiomas**

- [Français](#français)
- [English](#english)
- [Español](#español)

---

## Français

<details>
<summary><strong>Sommaire</strong></summary>

- [Aperçu](#aperçu)
- [Architecture](#architecture)
- [Prérequis](#prérequis)
- [Démarrage rapide (dev)](#démarrage-rapide-dev)
- [Variables d’environnement](#variables-denvironnement)
- [Scripts utiles](#scripts-utiles)
- [Dépannage](#dépannage)

</details>

### Aperçu

iiDmage centralise le suivi des commandes et leurs étapes principales : **Production → Expédition → Livraison → Pose**.

Fonctionnellement, l’app met l’accent sur :

- Une lecture claire de l’avancement par jalon (fait / planifié / aujourd’hui / en retard).
- Un calendrier pour naviguer par date et mettre à jour les jalons.
- Des notifications (et rappels) basées sur les dates.

### Architecture

- `frontend/` : Next.js (pages router) + React + Tailwind
- `backend/` : Express + Prisma + PostgreSQL
- `docker-compose.yml` : PostgreSQL (port **5433**) + Adminer (port **8080**)

Ports en dev (par défaut) :

- Frontend : http://localhost:3000
- Backend : http://localhost:4000
- DB : `localhost:5433`
- Adminer : http://localhost:8080

### Prérequis

- Node.js 18+ (recommandé)
- Docker Desktop (pour la DB PostgreSQL)

### Démarrage rapide (dev)

1) Base de données

```bash
npm run db:up
```

2) Installer les dépendances

```bash
npm install
cd backend && npm install
cd ../frontend && npm install
```

3) Configurer le backend

```bash
cd backend
copy .env.example .env  # PowerShell: Copy-Item .env.example .env
```

4) Prisma + seed (crée un compte OWNER)

```bash
npm run prisma:generate
npm run prisma:migrate
npm run seed
```

5) Lancer en dev

Depuis la racine (lance backend + frontend en parallèle) :

```bash
cd ..
npm run dev
```

Ou séparément :

```bash
npm run dev:backend
npm run dev:frontend
```

### Variables d’environnement

Backend (dans `backend/.env`, basé sur `backend/.env.example`) :

- `DATABASE_URL` : connexion PostgreSQL (par défaut: `localhost:5433`)
- `JWT_SECRET` : secret JWT (à remplacer)
- `PORT` : port API (par défaut `4000`)
- `CORS_ORIGIN` : origin(s) autorisés (ex: `http://localhost:3000`)
- `ADMIN_EMAIL` / `ADMIN_PASSWORD` : utilisés par `npm run seed` (change-les)
- `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASSWORD` : envoi d’emails (mot de passe oublié, etc.)

Frontend (optionnel, dans `frontend/.env.local`) :

```bash
NEXT_PUBLIC_API_URL=http://localhost:4000
```

> Note : la racine du repo contient aussi `.env.example` (référence). En pratique, le frontend lit ses variables depuis `frontend/`.

### Scripts utiles

À la racine :

- `npm run db:up` / `npm run db:down`
- `npm run dev` (backend + frontend)

Dans `backend/` :

- `npm run dev`
- `npm run prisma:generate`
- `npm run prisma:migrate`
- `npm run seed`

Dans `frontend/` :

- `npm run dev`
- `npm run build` / `npm run start`

### Dépannage

<details>
<summary><strong>401 / redirection vers login</strong></summary>

Le frontend nécessite un token stocké (localStorage/sessionStorage). Vérifie :

- que le backend tourne sur `http://localhost:4000`
- que `CORS_ORIGIN` autorise `http://localhost:3000`
- que `NEXT_PUBLIC_API_URL` pointe vers le bon backend

</details>

<details>
<summary><strong>Prisma: impossible de se connecter à la DB</strong></summary>

- Assure-toi que `npm run db:up` est lancé.
- Vérifie `DATABASE_URL` (port **5433** en dev).
- En cas de reset : `docker compose down -v` (supprime les données).

</details>

<details>
<summary><strong>SMTP (Gmail) : mot de passe d’application</strong></summary>

Pour Gmail, utilise un mot de passe d’application (après avoir activé la validation en 2 étapes) et renseigne-le dans `SMTP_PASSWORD`.

</details>

---

## English

<details>
<summary><strong>Table of contents</strong></summary>

- [Overview](#overview)
- [Architecture](#architecture-1)
- [Requirements](#requirements)
- [Quick start (dev)](#quick-start-dev)
- [Environment variables](#environment-variables)
- [Useful scripts](#useful-scripts)
- [Troubleshooting](#troubleshooting)

</details>

### Overview

iiDmage is an internal order-tracking monorepo focused on a simple milestone workflow: **Production → Shipping → Delivery → Installation**.

Core goals:

- One source of truth for milestone status (done / planned / due today / overdue).
- A calendar view to navigate by day and update milestones.
- Date-based notifications and reminders.

### Architecture

- `frontend/`: Next.js (pages router) + React + Tailwind
- `backend/`: Express + Prisma + PostgreSQL
- `docker-compose.yml`: PostgreSQL (**5433**) + Adminer (**8080**)

Default dev ports:

- Frontend: http://localhost:3000
- Backend: http://localhost:4000
- DB: `localhost:5433`
- Adminer: http://localhost:8080

### Requirements

- Node.js 18+ recommended
- Docker Desktop (for PostgreSQL)

### Quick start (dev)

1) Start the database

```bash
npm run db:up
```

2) Install dependencies

```bash
npm install
cd backend && npm install
cd ../frontend && npm install
```

3) Backend env

```bash
cd backend
copy .env.example .env  # PowerShell: Copy-Item .env.example .env
```

4) Prisma + seed (creates an OWNER account)

```bash
npm run prisma:generate
npm run prisma:migrate
npm run seed
```

5) Run dev

From repo root (runs backend + frontend):

```bash
cd ..
npm run dev
```

Or run them separately:

```bash
npm run dev:backend
npm run dev:frontend
```

### Environment variables

Backend (`backend/.env` from `backend/.env.example`):

- `DATABASE_URL`
- `JWT_SECRET`
- `PORT` (default `4000`)
- `CORS_ORIGIN` (default `http://localhost:3000`)
- `ADMIN_EMAIL` / `ADMIN_PASSWORD` (used by `npm run seed` — change them)
- `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASSWORD`

Frontend (optional `frontend/.env.local`):

```bash
NEXT_PUBLIC_API_URL=http://localhost:4000
```

### Useful scripts

Repo root:

- `npm run db:up` / `npm run db:down`
- `npm run dev` (both apps)

Backend:

- `npm run dev`, `npm run prisma:generate`, `npm run prisma:migrate`, `npm run seed`

Frontend:

- `npm run dev`, `npm run build`, `npm run start`

### Troubleshooting

<details>
<summary><strong>Getting 401s / redirected to /login</strong></summary>

Check that:

- backend is running on `http://localhost:4000`
- `CORS_ORIGIN` includes `http://localhost:3000`
- `NEXT_PUBLIC_API_URL` points to the correct backend

</details>

<details>
<summary><strong>Prisma can’t connect to Postgres</strong></summary>

- Make sure `npm run db:up` is running.
- Confirm `DATABASE_URL` uses port **5433**.
- If you need a full reset: `docker compose down -v`.

</details>

---

## Español

<details>
<summary><strong>Índice</strong></summary>

- [Resumen](#resumen)
- [Arquitectura](#arquitectura-2)
- [Requisitos](#requisitos)
- [Inicio rápido (dev)](#inicio-rápido-dev)
- [Variables de entorno](#variables-de-entorno)
- [Scripts útiles](#scripts-útiles)
- [Solución de problemas](#solución-de-problemas)

</details>

### Resumen

iiDmage es un monorepo interno para el seguimiento de pedidos con un flujo por hitos: **Producción → Expedición → Entrega → Instalación/Pose**.

Objetivos principales:

- Estado consistente por hito (hecho / planificado / hoy / atrasado).
- Calendario para navegar por fecha y actualizar hitos.
- Notificaciones basadas en fechas.

### Arquitectura

- `frontend/`: Next.js (pages router) + React + Tailwind
- `backend/`: Express + Prisma + PostgreSQL
- `docker-compose.yml`: PostgreSQL (**5433**) + Adminer (**8080**)

Puertos por defecto en dev:

- Frontend: http://localhost:3000
- Backend: http://localhost:4000
- DB: `localhost:5433`
- Adminer: http://localhost:8080

### Requisitos

- Node.js 18+ recomendado
- Docker Desktop (para PostgreSQL)

### Inicio rápido (dev)

1) Levantar base de datos

```bash
npm run db:up
```

2) Instalar dependencias

```bash
npm install
cd backend && npm install
cd ../frontend && npm install
```

3) Variables del backend

```bash
cd backend
copy .env.example .env  # PowerShell: Copy-Item .env.example .env
```

4) Prisma + seed (crea un usuario OWNER)

```bash
npm run prisma:generate
npm run prisma:migrate
npm run seed
```

5) Ejecutar en dev

Desde la raíz (backend + frontend):

```bash
cd ..
npm run dev
```

O por separado:

```bash
npm run dev:backend
npm run dev:frontend
```

### Variables de entorno

Backend (`backend/.env` desde `backend/.env.example`):

- `DATABASE_URL`
- `JWT_SECRET`
- `PORT` (por defecto `4000`)
- `CORS_ORIGIN` (por defecto `http://localhost:3000`)
- `ADMIN_EMAIL` / `ADMIN_PASSWORD` (los usa el `seed` — cámbialos)
- `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASSWORD`

Frontend (opcional `frontend/.env.local`):

```bash
NEXT_PUBLIC_API_URL=http://localhost:4000
```

### Scripts útiles

Raíz del repo:

- `npm run db:up` / `npm run db:down`
- `npm run dev`

Backend:

- `npm run dev`, `npm run prisma:generate`, `npm run prisma:migrate`, `npm run seed`

Frontend:

- `npm run dev`, `npm run build`, `npm run start`

### Solución de problemas

<details>
<summary><strong>401 / te manda a /login</strong></summary>

Revisa:

- backend en `http://localhost:4000`
- `CORS_ORIGIN` incluye `http://localhost:3000`
- `NEXT_PUBLIC_API_URL` apunta al backend correcto

</details>

<details>
<summary><strong>Prisma no conecta con Postgres</strong></summary>

- Asegúrate de ejecutar `npm run db:up`.
- Confirma que `DATABASE_URL` usa el puerto **5433**.
- Para reset total: `docker compose down -v`.

</details>
