# Backend (Express + Prisma)
FROM node:18-bookworm-slim
WORKDIR /app

# System deps (bcrypt native build fallback + Prisma engines)
RUN apt-get update \
	&& apt-get install -y --no-install-recommends \
		ca-certificates \
		openssl \
		python3 \
		make \
		g++ \
	&& rm -rf /var/lib/apt/lists/*

# Install deps
COPY package.json package-lock.json ./
RUN npm ci

# Copy source
COPY prisma ./prisma
COPY tsconfig.json ./tsconfig.json
COPY src ./src
COPY seed.js ./seed.js

# Generate Prisma client and build TS
RUN npx prisma generate
RUN npm run build

EXPOSE 4000

# Run migrations on start, then start server
CMD ["sh", "-lc", "npx prisma migrate deploy && node dist/main.js"]
