# Base image
FROM node:18-alpine

# Create app directory
WORKDIR /usr/src/app

# Install app dependencies
COPY package*.json ./
RUN npm install

# Bundle app source
COPY . .

# Build the NestJS application
RUN npm run build

# Expose the port your app runs on
EXPOSE 3000

# Start the server
CMD ["npm", "run", "start:prod"]