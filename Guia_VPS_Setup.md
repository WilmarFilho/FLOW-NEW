# Guia de Configuração da VPS e Deploy

## 1. Configurando Chave SSH e GitHub Actions

Para que o GitHub Actions consiga acessar sua VPS para executar as atualizações, precisamos gerar um par de chaves SSH e configurá-las.

### 1.1. Gerar as Chaves SSH (no seu PC ou servidor)
No seu terminal local (ou até mesmo acessando a VPS e depois retirando as chaves de lá de forma segura), execute o comando:
```bash
ssh-keygen -t rsa -b 4096 -C "seu_email@example.com"
```
Quando for solicitado, apenas pressione *Enter* para salvar no local padrão (`~/.ssh/id_rsa`). Deixe a senha em branco caso pergunte por passphrase, ou a action não conseguirá logar.

### 1.2. Configurar a Chave Pública na VPS
Copie o conteúdo da sua chave pública gerada (`~/.ssh/id_rsa.pub`) e adicione no arquivo `authorized_keys` da sua VPS (geralmente do usuário root, já que no `docker ps` mostrou ser o *root* base):

```bash
cat id_rsa.pub >> ~/.ssh/authorized_keys
```
Para garantir as permissões:
```bash
chmod 600 ~/.ssh/authorized_keys
chmod 700 ~/.ssh
```

### 1.3. Configurar GitHub Secrets
Acesse o repositório no GitHub, vá em **Settings** > **Secrets and variables** > **Actions** e crie os seguintes *Repository secrets*:

* `VPS_IP`: o IP da sua VPS (`104.131...` etc)
* `VPS_USER`: o usuário da VPS (provavelmente `root`)
* `VPS_SSH_KEY`: o conteúdo INTACTO da sua chave privada (`~/.ssh/id_rsa`), incluindo as bordas `-----BEGIN OPENSSH PRIVATE KEY-----`
* `ENV_PROD`: cole todo o conteúdo do arquivo `.env.prod`, devidamente preenchido com suas chaves de produção.

> **Onde fica a key da Evolution?**
> A `EVOLUTION_GLOBAL_API_KEY` fica no `.env.prod`, e de lá o deploy a injeta no `.env` da VPS via o secret `ENV_PROD` do GitHub Actions.
> No `docker-compose.yml` o serviço `evolution` carrega esse mesmo `.env` com `env_file: - .env`, então a chave chega ao container automaticamente.
> 
> Para gerar uma chave forte, rode localmente:
> ```bash
> # PowerShell
> -join ((65..90 + 97..122 + 48..57) * 100 | Get-Random -Count 40 | ForEach-Object {[char]$_})
> ```
> Ou no Linux/Mac: `openssl rand -hex 32`

## 2. NGINX e Domínios (SSL)

Você precisará usar nginx com proxy reverso e usar o Certbot/Let's Encrypt para o SSL (HTTPS).

### 2.1. Apontamento de DNS
No painel onde comprou seus domínios (Registro.br, Cloudflare, etc):
* Crie um registro tipo **A** para `flow.nkwflow.com` apontando para o IP da VPS.
* Crie um registro tipo **A** para `api.flow.nkwflow.com` apontando para o IP da VPS.
* **Crie um registro tipo A para `evolution.nkwflow.com` apontando para o mesmo IP da VPS.**

### 2.2. Criando arquivo de Configuração de Bloco `server` do NGINX
Crie ou crie um link simbólico no folder do Nginx `/etc/nginx/sites-available/flow.conf` com:

```nginx
server {
    listen 80;
    server_name flow.nkwflow.com;

    location / {
        proxy_pass http://127.0.0.1:3021; # Porta do Container Frontend
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

server {
    listen 80;
    server_name api.flow.nkwflow.com;

    location / {
        proxy_pass http://127.0.0.1:3022; # Porta do Container Backend
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

server {
    listen 80;
    server_name evolution.nkwflow.com;

    location / {
        proxy_pass http://127.0.0.1:8081; # Porta do Container Evolution (8081 -> 8080)
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Ative o arquivo fazendo link (se estiver usando Ubuntu moderno/Debian):
```bash
ln -s /etc/nginx/sites-available/flow.conf /etc/nginx/sites-enabled/
nginx -t
sudo systemctl reload nginx
```

### 2.3. Instalando SSL com Certbot
Rode:
```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d flow.nkwflow.com -d api.flow.nkwflow.com -d evolution.nkwflow.com
```

Escolha a opção de redirecionar trafego HTTP para HTTPS quando questionado. O Certbot já modificará a configuração inserida acima colocando os certificados.

## 3. Primeiro Deploy
Não esqueça que a action espera puxar o código do servidor root. Você precisa ter a pasta já clonada lá 1 vez para a action saber encontrar o repositório na VPS e rodar o `git pull`:

Na VPS faça:
```bash
cd /root
git clone https://github.com/WilmarFilho/FLOW-NEW.git FLOW
cd FLOW
# Apenas a partir do segundo commit a action fará tudo no auto-pilot..
```
