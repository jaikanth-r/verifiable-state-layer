FROM node:20-alpine AS build

WORKDIR /app

COPY package*.json ./
COPY apps/api/package.json apps/api/package.json
COPY packages/crypto/package.json packages/crypto/package.json
COPY packages/merkle/package.json packages/merkle/package.json
COPY packages/shared/package.json packages/shared/package.json
COPY packages/vsl-core/package.json packages/vsl-core/package.json

RUN npm ci

COPY tsconfig.json tsconfig.json
COPY apps/api apps/api
COPY packages packages
COPY database database
COPY scripts scripts

RUN npm run build --workspace=@vsl/api

FROM node:20-alpine AS runtime

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV HOST=0.0.0.0

COPY --from=build /app/package*.json ./
COPY --from=build /app/apps/api/package.json apps/api/package.json
COPY --from=build /app/apps/api/dist apps/api/dist
COPY --from=build /app/scripts scripts
COPY --from=build /app/database database
COPY --from=build /app/node_modules node_modules

EXPOSE 3000

CMD ["node", "apps/api/dist/index.js"]
