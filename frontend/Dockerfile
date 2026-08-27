FROM node:26-alpine AS build-stage

ARG VUE_APP_API_URL=http://localhost:3000/
ENV VUE_APP_API_URL=${VUE_APP_API_URL}
ENV NODE_OPTIONS=--openssl-legacy-provider

WORKDIR /usr/src/app
COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM httpd:2.4-alpine AS production-stage
COPY --from=build-stage /usr/src/app/dist /usr/local/apache2/htdocs/
EXPOSE 80
CMD ["httpd-foreground"]
