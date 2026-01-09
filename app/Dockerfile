FROM node:18

WORKDIR /app

# Copy package.json and install dependencies
COPY package.json .
RUN npm install

# Copy all remaining files, including views
COPY . .

EXPOSE 3000

CMD ["node", "server.js"]

