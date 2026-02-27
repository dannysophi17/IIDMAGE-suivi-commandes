# iiDmage — Suivi des commandes (scaffold)

Scaffold initial pour démarrer le projet interne de suivi des commandes.

Racine du repo contient deux dossiers: `backend` et `frontend`.

Quick start (après avoir installé dépendances):

## 0) Prérequis

- Docker Desktop (pour Postgres)
- Node.js (recommandé: Node 18+)

## 1) Base de données (dev)

1. Lancer la base de données pour dev:

```bash
docker compose up -d
```

La DB écoute sur `localhost:5433`.

2. Backend

```bash
cd backend
npm install
# copier .env.example → .env et ajuster si besoin
# IMPORTANT: remplir SMTP_USER/SMTP_PASSWORD pour que "Mot de passe oublié" envoie un email
npm run prisma:generate
npm run prisma:migrate
npm run seed
npm run dev
```

Identifiants admin (OWNER) par défaut (si tu n'as pas changé backend/.env):

- Email: valeur de `ADMIN_EMAIL`
- Mot de passe: valeur de `ADMIN_PASSWORD`

3. Frontend

```bash
cd frontend
npm install
npm run dev
```

Optionnel: pour pointer vers un autre backend en dev/prod, définir `NEXT_PUBLIC_API_URL`.

Exemple: créer `frontend/.env.local`:

```bash
NEXT_PUBLIC_API_URL=http://localhost:4000
```

## Gmail — mot de passe d'application (SMTP_PASSWORD)

Pour Gmail, tu dois créer une "contraseña de aplicación" (App password):

1. Va sur https://myaccount.google.com/security
2. Active la validation en 2 étapes
3. Ouvre "Mots de passe des applications" / "App passwords"
4. Crée un mot de passe pour l'app (ex: `iidmage-backend`)
5. Copie les 16 caractères et mets-les dans `backend/.env` comme `SMTP_PASSWORD`
