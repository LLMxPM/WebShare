# CI/CD 自动发布

文件功能描述：说明 WebShare 的 GitHub Actions 检查、自动发布、Windows 打包和 Docker Hub 推送配置。

## 工作流

- `.github/workflows/ci.yml`：推送 `main`、`master` 或提交拉取请求时，安装前端依赖、构建前端并执行 `go test ./...`。
- `.github/workflows/release.yml`：推送 `main`、`master` 或手动触发时，构建 Windows 发布包、创建 GitHub Release，并在配置 Docker Hub 后推送镜像。

Docker 镜像发布流程直接使用仓库根目录的 `Dockerfile` 构建，不依赖 `docker-compose.yml`。`docker-compose.yml` 只作为部署入口，`docker-compose.dev.yml` 只作为本地源码构建入口。

## 版本规则

主分支推送会自动生成 `v0.1.<run_number>` 版本号，例如 `v0.1.27`。手动触发 `Release` 工作流时，可以输入 `version` 覆盖自动版本号，格式应类似 `v1.2.3` 或 `v1.2.3-rc.1`。

## 需要配置

在 GitHub 仓库中进入 `Settings -> Actions -> General`，将 `Workflow permissions` 设置为 `Read and write permissions`，这样工作流才能创建 GitHub Release。

在 `Settings -> Secrets and variables -> Actions -> Secrets` 配置：

- `DOCKERHUB_USERNAME`：Docker Hub 用户名。
- `DOCKERHUB_TOKEN`：Docker Hub Access Token，至少需要目标仓库的读写权限。

在 `Settings -> Secrets and variables -> Actions -> Variables` 配置：

- `DOCKERHUB_REPOSITORY`：Docker Hub 镜像名，当前项目使用 `llmxpm/webshare`。

如果没有配置 `DOCKERHUB_REPOSITORY`，Docker 推送任务会跳过；Windows Release 仍会正常生成。配置了 `DOCKERHUB_REPOSITORY` 后，如果缺少 Docker Hub 密钥，发布流程会失败并提示缺少的配置。

## 发布产物

- GitHub Release 附件：`WebShare-<version>-windows-amd64.zip`，包含 `webshare.exe`、`README.md` 和 `LICENSE.txt`。
- Docker Hub 镜像标签：`<version>`、`latest` 和 `sha-<commit>`。
