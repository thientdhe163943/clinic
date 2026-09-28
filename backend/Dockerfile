# Multi-stage build: compile TypeScript + generate Prisma client in `build`,
# ship only the pruned production node_modules + compiled dist in the final
# image.

FROM node:20-slim AS build
WORKDIR /app

# openssl must be present BEFORE `prisma generate` so it can correctly
# detect the runtime's actual libssl version and pick the matching engine
# binary target — without it, Prisma silently guesses "openssl-1.1.x",
# which can mismatch the production stage's real openssl and break the
# query engine at container startup with a hard-to-diagnose native-module
# load error.
RUN apt-get update && apt-get install -y --no-install-recommends openssl \
    && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npx prisma generate
RUN npm run build
RUN npm prune --omit=dev

FROM node:20-slim AS production
WORKDIR /app
ENV NODE_ENV=production

# fonts-dejavu-core/fonts-noto: Unicode fonts pdf.service.ts needs to render
# Vietnamese diacritics in generated PDFs (queue tickets, prescriptions...).
# openssl/ca-certificates: required by Prisma's query engine at runtime.
RUN apt-get update && apt-get install -y --no-install-recommends \
    fonts-dejavu-core fonts-noto openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

COPY --from=build /app/dist ./dist
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/package.json ./package.json

EXPOSE 3001
CMD ["node", "dist/main.js"]
