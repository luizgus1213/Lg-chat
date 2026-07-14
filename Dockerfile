FROM node:22.14.0-bookworm-slim AS build

WORKDIR /app

ENV CI=true

COPY package.json package-lock.json ./
COPY client/package.json client/package-lock.json ./client/

RUN npm ci
RUN npm --prefix client ci

COPY . .

RUN npm run build


FROM node:22.14.0-bookworm-slim AS production

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=5000
ENV UPLOAD_ROOT=/data/uploads

COPY package.json package-lock.json ./

RUN npm ci --omit=dev \
    && npm cache clean --force

COPY --from=build /app/dist ./dist
COPY --from=build /app/client/dist ./client/dist
COPY --from=build /app/src ./src
COPY --from=build /app/config.cjs ./config.cjs
COPY --from=build /app/.sequelizerc ./.sequelizerc

RUN mkdir -p /data/uploads/chat-media \
    /data/uploads/groups \
    /data/uploads/status \
    /data/uploads/users

EXPOSE 5000

HEALTHCHECK \
  --interval=30s \
  --timeout=5s \
  --start-period=40s \
  --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:' + (process.env.PORT || '5000') + '/health').then((response) => { if (!response.ok) process.exit(1); }).catch(() => process.exit(1));"

CMD ["npm", "run", "start:production"]