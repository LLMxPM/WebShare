# 静态前端项目托管工具

这是一个 Go 单体应用，用于托管 Vue、React、Vite、Webpack 等常见前端构建产物。它支持 ZIP 发布、单 HTML 发布、SPA history fallback、用户隔离、项目激活/停用、版本回滚、文件管理、路径冲突检测和项目独立端口访问。

## 端口模型

- `8080`：管理后台和 API，访问 `http://localhost:8080/admin/`
- `8081`：分享网关，提供 `/p/{slug}/` 和自定义挂载路径
- `12000-12999`：项目独立端口池，用于兼容依赖 `/` 根路径的前端产物

系统不支持域名或子域名模式；无域名场景下，根路径构建产物优先使用独立端口。

## 管理后台

后台采用三栏工作台。普通用户只能管理自己的项目；管理员额外拥有“用户”和“分享地址”两个独立页面。

- “用户”页面用于搜索、创建、编辑、禁用或启用用户，并支持重置密码和邮箱登录。
- “分享地址”页面用于检测本机 IP 候选地址，并选择项目访问地址生成时使用的主机。

## BaseURL 处理

系统只识别 base URL，不改写 HTML、CSS、JS 或 manifest。

- 相对路径：推荐 `http://host:8081/p/{slug}/`
- `/xxx/` 固定前缀：推荐 `http://host:8081/xxx/`
- `/` 根路径：推荐独立端口，例如 `http://host:12001/`
- 多个根路径前缀：优先推荐独立端口，并提示文件结构风险

`fetch('/api')`、service worker、manifest 和 JS 动态拼接路径只做风险提示，不自动代理或修复。

## 本地运行

```powershell
pnpm --dir web install
pnpm --dir web build
go build -ldflags="-H windowsgui" -o bin/static-host-runner-windows-amd64.exe ./cmd/static-runner
Copy-Item bin/static-host-runner-windows-amd64.exe internal/runnerstub/static-host-runner-windows-amd64.exe
go build -tags embedrunner -ldflags="-H windowsgui" -o release/static-host.exe ./cmd/static-host
go test ./...
go run ./cmd/static-host
```

首次启动如果数据库中没有用户，会创建管理员。可以通过环境变量指定初始账号：

```powershell
$env:INIT_ADMIN_USER="admin"
$env:INIT_ADMIN_PASSWORD="change-me-123"
go run ./cmd/static-host
```

如果没有设置 `INIT_ADMIN_PASSWORD`，服务会在日志中输出一次性初始密码。

## 容器部署

```powershell
docker compose up --build
```

默认暴露：

- `8080:8080`
- `8081:8081`
- `12000-12999:12000-12999`

如果不需要独立端口模式，可以只暴露 `8080` 和 `8081`，但根路径 `/` base 的项目兼容性会下降。

## 主要环境变量

| 变量 | 默认值 | 说明 |
|---|---:|---|
| `DATA_DIR` | `data` | SQLite 和项目文件目录 |
| `ADMIN_ADDR` | `:8080` | 管理服务监听地址 |
| `SHARE_ADDR` | `:8081` | 分享网关监听地址 |
| `PUBLIC_HOST` | `localhost` | 生成访问地址使用的主机或 IP |
| `PUBLIC_SCHEME` | `http` | 生成访问地址使用的协议 |
| `PORT_START` | `12000` | 独立端口池起始端口 |
| `PORT_END` | `12999` | 独立端口池结束端口 |
| `MAX_UPLOAD_MB` | `300` | 上传文件大小限制 |
| `INIT_ADMIN_USER` | `admin` | 首次启动管理员用户名 |
| `INIT_ADMIN_PASSWORD` | 空 | 首次启动管理员密码 |
| `RUNNER_STUB_PATH` | `bin/static-host-runner-windows-amd64.exe` | 下载 EXE 时使用的预编译 Windows 壳程序 |

## EXE 打包下载

已发布项目可以在管理后台点击“下载 EXE”。服务端会读取项目当前版本目录，把静态文件追加到预编译 Windows 壳程序后生成单文件 exe。用户运行 exe 后，程序会在系统托盘常驻，启动 `127.0.0.1` 随机端口服务，并用默认浏览器打开项目页面。

壳程序需要提前构建：

```powershell
go build -ldflags="-H windowsgui" -o bin/static-host-runner-windows-amd64.exe ./cmd/static-runner
```

如果部署到容器，镜像构建流程会自动生成并复制该壳程序。

## Windows 单 EXE 交付

运行构建脚本：

```powershell
.\scripts\build-windows-single.ps1
```

生成文件：

```text
release/static-host.exe
```

交付时只需要发送这个 exe。用户双击后程序会进入 Windows 系统托盘，自动打开管理后台，并在 exe 所在目录生成 `data/` 目录保存数据库和上传项目。托盘菜单提供“打开管理页面”“复制管理地址”“显示管理员账户和密码”“复制管理员账户和密码”“重置管理员账户”“退出”；重置管理员账户会生成 10 位复杂密码、弹窗展示并复制到剪贴板。

## API 概览

- `POST /api/auth/login`（支持用户名或邮箱）
- `POST /api/auth/logout`
- `GET /api/me`
- `GET /api/users`
- `POST /api/users`
- `PATCH /api/users/{id}`
- `POST /api/users/{id}/reset-password`
- `GET /api/projects`
- `POST /api/projects`
- `GET /api/projects/{id}`
- `PATCH /api/projects/{id}`
- `DELETE /api/projects/{id}`
- `POST /api/projects/{id}/activate`
- `POST /api/projects/{id}/deactivate`
- `POST /api/projects/{id}/publish/zip`
- `POST /api/projects/{id}/publish/html`
- `GET /api/projects/{id}/packages/exe`
- `GET /api/projects/{id}/versions`
- `POST /api/projects/{id}/versions/{versionId}/activate`
- `GET /api/projects/{id}/files?path=...`
- `PUT /api/projects/{id}/files?path=...`
- `DELETE /api/projects/{id}/files?path=...`
- `GET /api/projects/{id}/files/download?path=...`
- `POST /api/projects/{id}/share-token`
- `GET /api/system/public-host`
- `PATCH /api/system/public-host`
