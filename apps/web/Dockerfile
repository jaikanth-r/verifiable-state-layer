FROM node:20-alpine AS build

WORKDIR /app

COPY package*.json ./
COPY apps/web/package.json apps/web/package.json

RUN npm ci

COPY tsconfig.json tsconfig.json
COPY apps/web apps/web

RUN npm run build --workspace=@vsl/web

FROM nginx:1.27-alpine

COPY --from=build /app/apps/web/dist /usr/share/nginx/html
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 3000

CMD ["nginx", "-g", "daemon off;"]
