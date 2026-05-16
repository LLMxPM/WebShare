# 文件功能描述：构建 Windows 单 EXE 交付包，主程序内嵌管理前端和项目 EXE 壳。
$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

pnpm --dir web build

New-Item -ItemType Directory -Force bin | Out-Null
New-Item -ItemType Directory -Force internal\runnerstub | Out-Null
New-Item -ItemType Directory -Force release | Out-Null

$env:CGO_ENABLED = "0"
$env:GOOS = "windows"
$env:GOARCH = "amd64"

go build -ldflags="-H windowsgui" -o bin\static-host-runner-windows-amd64.exe ./cmd/static-runner
Copy-Item -LiteralPath bin\static-host-runner-windows-amd64.exe -Destination internal\runnerstub\static-host-runner-windows-amd64.exe -Force
go build -tags embedrunner -ldflags="-H windowsgui" -o release\static-host.exe ./cmd/static-host

Remove-Item Env:CGO_ENABLED -ErrorAction SilentlyContinue
Remove-Item Env:GOOS -ErrorAction SilentlyContinue
Remove-Item Env:GOARCH -ErrorAction SilentlyContinue

Write-Host "已生成 release\static-host.exe"
