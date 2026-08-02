# chainssh

**SSH multi-hop transparente com portas dinâmicas**

Conecta-se a um destino SSH através de uma cadeia de servidores intermediários,
usando alocação dinâmica de portas em cada salto — similar ao `ProxyJump` do
OpenSSH, mas como binário standalone em Go (zero dependências, single binary).

## Como funciona

```
Maquina A (você)          Maquina B (jump)          Maquina C (destino)
┌──────────────┐         ┌──────────────┐         ┌──────────────┐
│ chainssh     │──SSH──▶ │ servidor     │──SSH──▶ │ servidor     │
│              │         │ jumper       │         │ destino      │
│ localhost    │         │              │         │              │
└──────────────┘         └──────────────┘         └──────────────┘
   porta dinâmica          porta dinâmica            porta 22
```

Cada hop intermediário usa `ssh.Client.Dial("tcp", nextHost)` para criar um
túnel TCP através da conexão SSH existente, depois faz upgrade para uma nova
conexão SSH. As portas são alocadas dinamicamente pelo protocolo SSH —
**nenhuma porta fixa é necessária nos saltos**.

## Instalação

```bash
# Requer Go 1.23+
cd tools/chainssh
go build -ldflags="-s -w" -o chainssh .

# Binário único ~8 MB, pronto para deploy
./chainssh --help
```

### Cross-compile para Linux

```bash
GOOS=linux GOARCH=amd64 go build -ldflags="-s -w" -o chainssh .
```

## Uso

### Shell interativo (padrão)

```bash
# Conexão direta (1 hop)
chainssh root@meu-servidor.com

# Jump único: local → jumper → servidor interno
chainssh admin@jump.exemplo.com,root@192.168.1.100

# Cadeia de 3 hops com portas diferentes
chainssh user@jump1:2222,user@jump2,root@target -i ~/.ssh/id_rsa
```

### Port forwarding (-L)

```bash
# Acessar banco de dados interno através da cadeia
chainssh -L 5432:db.interno:5432 jump,db-host

# Agora conecte localmente:
psql -h localhost -p 5432
```

### Remote forwarding (-R)

```bash
# Expor porta local no servidor remoto
chainssh -R 8080:localhost:3000 jump,server
```

### SOCKS5 proxy (-D)

```bash
# Iniciar proxy SOCKS5 na porta 1080
chainssh -D 1080 jump,server

# Com bind address específico
chainssh -D 127.0.0.1:9999 jump,server
```

Configure o navegador ou ferramenta para usar `socks5://127.0.0.1:1080`.
Todo o tráfego é roteado através da cadeia SSH.

```bash
# Exemplo: curl através do proxy
curl --socks5 127.0.0.1:1080 https://ifconfig.me

# Firefox: Settings → Network Settings → SOCKS5: 127.0.0.1:1080
```

### Comando remoto (-c)

```bash
chainssh -c "uptime && df -h" jump,server
```

## Autenticação

O chainssh tenta, em ordem:

| Prioridade | Método | Como usar |
|---|---|---|
| 1 | **SSH Agent** | Unix: `SSH_AUTH_SOCK` / Windows: named pipe automático |
| 2 | **Chave privada** | `-i ~/.ssh/id_rsa` (pode repetir) |
| 3 | **Senha** | `-P "minha-senha"` |

> **Windows**: Dois agentes são suportados, testados em ordem:
> 1. **OpenSSH agent** — named pipe `\\.\pipe\openssh-ssh-agent`
> 2. **Pageant** (PuTTY) — fallback via shared memory (`FindWindow` + `WM_COPYDATA`)
>
> OpenSSH:
> ```powershell
> Get-Service ssh-agent | Start-Service
> ssh-add ~/.ssh/id_rsa
> ```
>
> Pageant: basta iniciar o Pageant e adicionar as chaves via GUI.
> O chainssh detecta automaticamente qual agente está disponível.

## Flags

| Flag | Descrição |
|---|---|
| `-l` | Usuário SSH padrão (padrão: `$USER`) |
| `-p` | Porta SSH padrão (padrão: 22) |
| `-i` | Arquivo de chave privada (pode repetir) |
| `-P` | Senha SSH |
| `-L lp:rh:rp` | Port forwarding local |
| `-R rp:lh:lp` | Port forwarding remoto |
| `-D [addr:]port` | Proxy SOCKS5 dinâmico |
| `-c` | Executar comando no destino |
| `-t` | Timeout de conexão (padrão: 10s) |
| `-v` | Verbose |
| `--insecure` | Suprimir aviso de host key |

## Arquitetura

```
chainssh/
├── main.go              # CLI + flags + orquestração
├── agent_unix.go        # SSH agent via Unix socket (SSH_AUTH_SOCK)
├── agent_windows.go     # SSH agent via Windows named pipe (go-winio)
├── tools.go             # Mantém dependência go-winio no go.mod
├── internal/
│   ├── config/          # Parsing da cadeia (user@host:port,...)
│   ├── chain/           # Conexão multi-hop (core) + keepalive
│   └── tunnel/          # Shell interativo, port forwarding (L/R)
└── go.mod
```

### Fluxo de conexão

1. **Parse**: `user@jump:22,root@target` → `[]HopConfig`
2. **Hop 1**: `net.Dial("tcp", "jump:22")` → upgrade SSH → `clientA`
3. **Hop 2**: `clientA.Dial("tcp", "target:22")` → upgrade SSH → `clientB`
4. **Final**: shell interativo ou port forward via `clientB`

## Licença

MIT
