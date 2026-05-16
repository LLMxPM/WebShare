# 部署文档

文件功能描述：说明 WebShare 的部署方式、端口模型、环境变量和 Windows 单 EXE 交付流程。

## 部署形态

WebShare 支持三种常见部署方式：

- 本机直接运行：适合开发、临时演示和小范围局域网分享。
- Docker Compose：适合固定服务器或小型局域网主机。
- Windows 单 EXE：适合非技术用户双击运行，自动打开管理后台并常驻系统托盘。

## 端口模型

- `8080`：管理后台和 API，默认访问 `http://localhost:8080/admin/`。
- `8081`：分享网关，提供 `/p/{slug}/` 和自定义挂载路径。
- `12000-12999`：项目独立端口池，用于兼容依赖 `/` 根路径的前端产物。

系统不依赖域名或子域名。局域网环境下，优先通过本机 IP 和端口生成访问地址。

## Docker Compose 部署

启动服务：

```powershell
docker compose up --build
```

默认端口映射：

```text
8080:8080
8081:8081
12000-12999:12000-12999
```

默认数据卷为 `webshare-data`，容器内数据目录为 `/data`。如果不需要独立端口模式，可以只暴露 `8080` 和 `8081`，但根路径 `/` base 的项目兼容性会下降。

Docker 场景默认同时输出日志到容器标准输出和 `/data/logs/webshare.log`。常用查看方式：

```powershell
docker compose logs -f webshare
docker compose exec webshare tail -f /data/logs/webshare.log
```

## Windows 单 EXE 交付

构建命令：

```powershell
.\scripts\build-windows-single.ps1
```

生成文件：

```text
release/webshare.exe
```

交付时只需要发送 `release/webshare.exe`。用户双击后，程序会进入 Windows 系统托盘，自动打开管理后台，并在 exe 所在目录生成 `data/` 目录保存数据库和上传项目。

Windows 单 EXE 默认不打开控制台，运行日志写入 exe 同级目录下的 `data/logs/webshare.log`。

托盘菜单提供：

- 打开管理页面。
- 复制管理地址。
- 显示管理员账户和密码。
- 复制管理员账户和密码。
- 重置管理员账户。
- 退出。

## 主要环境变量

| 变量 | 默认值 | 说明 |
|---|---:|---|
| `DATA_DIR` | `data` | SQLite 和项目文件目录 |
| `ADMIN_ADDR` | `:8080` | 管理服务监听地址 |
| `SHARE_ADDR` | `:8081` | 分享网关监听地址 |
| `PUBLIC_HOST` | 自动检测 | 生成访问地址使用的主机或 IP，默认取第一个局域网 IPv4，失败时回退 `localhost` |
| `PUBLIC_SCHEME` | `http` | 生成访问地址使用的协议 |
| `PORT_START` | `12000` | 独立端口池起始端口 |
| `PORT_END` | `12999` | 独立端口池结束端口 |
| `MAX_UPLOAD_MB` | `300` | 上传文件大小限制 |
| `INIT_ADMIN_USER` | `admin` | 首次启动管理员用户名 |
| `INIT_ADMIN_PASSWORD` | 空 | 首次启动管理员密码 |
| `RUNNER_STUB_PATH` | `bin/webshare-runner-windows-amd64.exe` | 下载项目 EXE 时使用的预编译 Windows 壳程序 |
| `LOG_FILE` | `<DATA_DIR>/logs/webshare.log` | 运行日志文件路径 |
| `LOG_STDOUT` | Linux/Docker 为 `true`，Windows 为 `false` | 是否同时输出到标准输出 |
| `LOG_MAX_SIZE_MB` | `10` | 单个日志文件最大体积 MB |
| `LOG_MAX_BACKUPS` | `5` | 保留的旧日志文件数量 |
| `LOG_MAX_AGE_DAYS` | `30` | 旧日志文件保留天数 |

## 初始管理员

首次启动时，如果数据库中没有用户，系统会创建管理员账号。可以通过环境变量指定账号和密码：

```powershell
$env:INIT_ADMIN_USER="admin"
$env:INIT_ADMIN_PASSWORD="change-me-123"
go run ./cmd/webshare
```

如果没有设置 `INIT_ADMIN_PASSWORD`，服务会在空库首次启动时把一次性初始密码写入运行日志。Windows 单 EXE 模式下，也可以通过托盘菜单查看或重置管理员账号。

## 局域网访问注意事项

- 确保防火墙允许管理端口、分享端口和需要使用的独立端口。
- 多网卡机器应在管理后台的“分享地址”页面选择正确的局域网 IP。
- 如果项目使用独立端口访问，需要同时开放对应端口池。
- 使用 Docker 部署时，`PUBLIC_HOST` 建议设置为宿主机局域网 IP，而不是容器内地址。
