# WebShare

文件功能描述：概述 WebShare 的项目定位、核心能力和文档入口。

## 项目意义

大模型的发展正在改变静态页面的生产方式：单个 HTML、临时演示页、一次性原型和小型前端产物的生产越来越简单，数量也越来越多。它们通常不值得单独部署一套完整服务，但又需要在团队、教室、展厅或办公室局域网内快速打开、预览和分享。

WebShare 面向这种局域网环境，提供静态页面的快捷托管、分享和管理能力。用户可以把单 HTML、文件夹或 ZIP 构建产物上传到本机服务，由系统生成局域网访问地址，并根据页面资源路径选择分享网关、挂载路径或独立端口访问方式。

## 核心能力

- 支持单 HTML、文件夹和 ZIP 发布。
- 支持项目启用、停用、版本管理和回滚。
- 支持普通用户项目隔离，管理员管理用户和分享地址。
- 支持 `/p/{slug}/` 分享、固定挂载路径和项目独立端口。
- 支持 Windows 单 EXE 交付，并可为已发布项目生成独立运行 EXE。

## 快速运行

```powershell
pnpm --dir web install
pnpm --dir web build
go run ./cmd/webshare
```

启动后访问：

- 管理后台：`http://localhost:8080/admin/`
- 分享网关：`http://localhost:8081/`

首次启动会创建管理员账号。若未设置初始密码，服务日志会输出一次性密码。

运行日志默认写入 `data/logs/webshare.log`。Docker 部署会同时输出到 `docker logs` 和 `/data/logs/webshare.log`；Windows 单 EXE 双击运行时默认只写入 exe 同级目录下的 `data/logs/webshare.log`。

## 文档

- [开发文档](docs/development.md)：本地开发、项目结构、构建测试和代码约定。
- [部署文档](docs/deployment.md)：容器部署、Windows 单 EXE 交付、端口和环境变量。
- [使用文档](docs/usage.md)：登录、发布项目、分享地址、版本管理和常见路径选择。
