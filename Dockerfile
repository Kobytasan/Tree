FROM node:24-alpine
WORKDIR /app
COPY package.json ./
COPY server.js ./
COPY public ./public
RUN mkdir -p data
VOLUME ["/app/data"]
EXPOSE 3000
CMD ["npm", "start"]
