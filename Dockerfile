# --- STAGE 1: Build the Angular application ---
FROM node:20-slim AS builder

# Set the working directory inside the container
WORKDIR /app

# Copy package.json and package-lock.json first to leverage Docker caching.
COPY package.json package-lock.json ./
RUN npm install

# Copy the rest of the application source code AND the NGINX CONFIG FILE
COPY . .

# 🚨 FIX: Force outputMode=static to skip SSR/Prerendering failure 🚨
# The output path will be 'dist/item-manager/browser'
RUN npm run build -- --configuration=production --output-mode=static

# --- STAGE 2: Serve the application using a lightweight Nginx web server ---
FROM nginx:alpine

# Copy the custom Nginx configuration file
COPY --from=builder /app/nginx-custom.conf /etc/nginx/conf.d/default.conf

# 🚨 CRITICAL FIX: Copy the built files from the 'browser' sub-folder 🚨
COPY --from=builder /app/dist/item-manager/browser /usr/share/nginx/html

# The container exposes port 80 (default for Nginx)
EXPOSE 80
