FROM node:22-alpine AS builder

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --production=false
COPY tsconfig.json tsconfig.cjs.json ./
COPY src/ src/
COPY server.ts ./
RUN npx tsc

FROM node:22-alpine

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --production
COPY --from=builder /app/dist dist/
COPY schema/ schema/

ENV PORT=3000
EXPOSE 3000

CMD ["node", "dist/esm/server.js"]
