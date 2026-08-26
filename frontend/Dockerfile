FROM node:latest as build-stage
WORKDIR /usr/src/app
COPY . .
RUN npm install && npm run build

FROM httpd:2.4 as production-stage
COPY --from=build-stage /usr/src/app/dist /usr/local/apache2/htdocs/
EXPOSE 80
CMD ["httpd-foreground"]