FROM node:20-alpine

WORKDIR /app

ENV NODE_ENV=production

COPY package.json package-lock.json* ./
RUN npm install --omit=dev

COPY server ./server
COPY catalog.json ./catalog.json

EXPOSE 5375

CMD ["node", "server/index.js"]
