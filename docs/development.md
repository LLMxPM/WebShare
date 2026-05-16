# 开发文档

文件功能描述：说明 WebShare 的本地开发环境、项目结构、构建测试流程和代码约定。

## 技术栈

WebShare 是 Go 单体应用，管理后台由 Vite 和 TypeScript 构建后嵌入 Go 服务。后端负责用户、项目、版本、文件存储、分享网关和项目独立端口服务；前端负责管理工作台。

- 后端：Go，SQLite，标准库 HTTP 服务。
- 前端：Vite，TypeScript，pnpm。
- 数据：默认写入 `data/`，包含 SQLite 数据库和上传后的项目文件。
- Windows 交付：主程序可内嵌管理前端和项目 EXE 壳程序。

## 目录结构

```text
cmd/webshare/              主程序入口
cmd/webshare-runner/       已发布项目下载 EXE 时使用的运行壳
internal/app/              应用服务、HTTP 路由、项目生命周期
internal/config/           运行配置和环境变量读取
internal/store/            SQLite 存储和迁移
internal/storage/          项目文件存储
internal/security/         密码、会话和令牌相关逻辑
web/                       管理后台前端
scripts/                   构建脚本
docs/                      项目文档
```

## 本地开发

安装前端依赖：

```powershell
pnpm --dir web install
```

构建管理后台：

```powershell
pnpm --dir web build
```

运行后端：

```powershell
go run ./cmd/webshare
```

默认管理后台地址为 `http://localhost:8080/admin/`。如果数据库中没有用户，首次启动会创建管理员；没有设置 `INIT_ADMIN_PASSWORD` 时，日志会输出一次性密码。

## 常用命令

运行全部测试：

```powershell
go test ./...
```

构建项目运行壳：

```powershell
go build -ldflags="-H windowsgui" -o release/webshare-runner-windows-amd64.exe ./cmd/webshare-runner
```

把运行壳复制到后端默认读取位置：

```powershell
Copy-Item release/webshare-runner-windows-amd64.exe internal/runnerstub/webshare-runner-windows-amd64.exe
```

构建内嵌运行壳的 Windows 主程序：

```powershell
go build -tags embedrunner -ldflags="-H windowsgui" -o release/webshare.exe ./cmd/webshare
```

一键构建 Windows 单 EXE：

```powershell
.\scripts\build-windows-single.ps1
```

## 开发约定

- 使用中文协作和编写项目文档。
- 前端依赖使用 pnpm 管理。
- 单个代码文件过长或职责变复杂时，应拆分模块。
- 源代码文件开头保留文件功能描述。
- 函数注释优先说明职责、输入输出和关键约束。
- 项目通常已经启动，开发时不要反复启动服务；确认端口占用后再决定是否重启。

## 调试提示

- 管理端口默认是 `8080`，分享网关默认是 `8081`。
- 独立端口池默认是 `12000-12999`，用于兼容依赖根路径 `/` 的静态页面。
- 前端构建产物位于 `web/dist/`，后端会从该目录提供管理后台资源。
- 项目数据默认写入 `data/`，调试时清理该目录会同时清理用户、项目和上传文件。
