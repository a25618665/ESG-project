FROM node:24-alpine

ENV NODE_ENV=production
ENV MIGRATIONS_DIR=/usr/src/app/migrations
WORKDIR /usr/src/app

COPY backend/package*.json ./
RUN npm ci --omit=dev

COPY --chown=node:node backend/ .
COPY --chown=node:node database/init/ ./migrations/

USER node
EXPOSE 3000
STOPSIGNAL SIGTERM
CMD ["node", "bin/www"]
