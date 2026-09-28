# Multi-stage build using Next.js standalone output (next.config.mjs sets
# output: 'standalone') — the final image ships only the traced dependency
# subset instead of the full node_modules tree.
#
# IMPORTANT: NEXT_PUBLIC_* vars are baked into the client bundle at BUILD
# time, not read at container runtime — must be passed as --build-arg (see
# setting them via `docker run -e` alone has no effect on already-built pages.

FROM node:20-slim AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_APP_NAME
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_APP_NAME=$NEXT_PUBLIC_APP_NAME
RUN npm run build

FROM node:20-slim AS production
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

COPY --from=build /app/public ./public
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static

EXPOSE 3000
CMD ["node", "server.js"]
