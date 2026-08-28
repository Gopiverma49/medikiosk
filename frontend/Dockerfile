FROM node:20-slim AS base
WORKDIR /app

COPY package.json ./
RUN npm install

COPY . .

ENV NEXT_PUBLIC_API_BASE=http://backend:8000
ENV NODE_ENV=production

RUN npm run build

EXPOSE 3000
CMD ["npm", "start"]
