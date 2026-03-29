# STAGE 1: Build React App bằng Node.js 20
FROM node:20-alpine as build
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

# STAGE 2: Chạy App bằng Nginx
FROM nginx:alpine
# Copy file build từ stage 1 sang Nginx
COPY --from=build /app/dist /usr/share/nginx/html
# Copy cấu hình Nginx để fix lỗi React Router
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]