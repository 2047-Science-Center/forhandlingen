# Kombinerad app + WebSocket-relä (för Fly.io/Railway/valfri container-host).
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build:relay
ENV PORT=8080
EXPOSE 8080
CMD ["node", "server/server.mjs"]
