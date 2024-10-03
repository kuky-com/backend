FROM node:20-alpine

WORKDIR /app

COPY package.json yarn.lock ./

RUN yarn install  --production=false

COPY . .

EXPOSE 8000

CMD ["yarn", "dev"]
