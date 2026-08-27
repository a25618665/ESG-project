FROM node:24-alpine AS build-stage

ARG VITE_API_URL=http://localhost:3000/
ENV VITE_API_URL=${VITE_API_URL}

WORKDIR /usr/src/app
COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM httpd:2.4-alpine AS production-stage
COPY --from=build-stage /usr/src/app/dist /usr/local/apache2/htdocs/
EXPOSE 80
CMD ["httpd-foreground"]
