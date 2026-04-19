# Base image
FROM node:20-alpine AS builder

# Create app directory
WORKDIR /app

# A wildcard is used to ensure both package.json AND package-lock.json are copied
COPY package*.json ./

# Install app dependencies
RUN npm ci

# Bundle app source
COPY . .

# Creates a "dist" folder with the production build
RUN npm run build

# ---

# Base image for production
FROM node:20-alpine AS production

WORKDIR /app

# Install postgresql-client (pg_dump) for backup jobs
RUN apk add --no-cache postgresql-client

# Copy the bundled code from the builder stage to the production image
COPY package*.json ./
RUN npm ci --only=production
COPY --from=builder /app/dist ./dist

# Start the server using the production build
CMD [ "node", "dist/main.js" ]
