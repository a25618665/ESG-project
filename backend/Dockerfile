FROM node:26-alpine

ENV NODE_ENV=production
WORKDIR /usr/src/app

COPY package*.json ./
RUN npm ci --omit=dev

COPY --chown=node:node . .

USER node
EXPOSE 3000
CMD ["node", "bin/www"]
