FROM node:20-slim

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install --omit=dev --no-audit --no-fund && npm install typescript --no-save

COPY tsconfig.json ./
COPY src ./src

RUN npx tsc

CMD ["node", "dist/index.js"]
