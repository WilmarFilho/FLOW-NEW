# Estágio 1: Builder - Onde a aplicação React é construída
FROM node:18-alpine AS builder

WORKDIR /app

# Copia os arquivos de definição de dependências
COPY package*.json ./

# Instala as dependências
RUN npm install

# Copia o restante do código da aplicação
COPY . .

# Executa o build de produção. Isso cria a pasta /app/dist
RUN npm run build

# ---

# Estágio 2: Production - O servidor Nginx que servirá os arquivos
FROM nginx:stable-alpine

# Copia os arquivos estáticos da pasta "dist" para a pasta do Nginx
# ESTA É A LINHA CORRIGIDA 👇
COPY --from=builder /app/dist /usr/share/nginx/html

# Copia a configuração customizada do Nginx para lidar com o React Router
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Expõe a porta 80, que é a porta padrão do Nginx
EXPOSE 80

# Comando padrão para iniciar o Nginx no foreground
CMD ["nginx", "-g", "daemon off;"]