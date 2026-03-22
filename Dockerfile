FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npx vite build

RUN npm prune --omit=dev

EXPOSE 5050

CMD ["node", "server/server.js"]
