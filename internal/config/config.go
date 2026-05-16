// 文件功能描述：读取运行配置，统一管理端口、数据目录、上传限制和初始化管理员参数。
package config

import (
	"flag"
	"os"
	"strconv"
	"strings"
)

// Config 描述应用运行所需的全部配置项。
type Config struct {
	DataDir           string
	AdminAddr         string
	ShareAddr         string
	PublicHost        string
	PublicScheme      string
	PortStart         int
	PortEnd           int
	MaxUploadBytes    int64
	InitAdminUser     string
	InitAdminPassword string
	RunnerStubPath    string
	RunnerStubBytes   []byte
}

// Load 从命令行和环境变量读取配置；命令行参数优先于默认值。
func Load() Config {
	cfg := Config{
		DataDir:        env("DATA_DIR", "data"),
		AdminAddr:      env("ADMIN_ADDR", ":8080"),
		ShareAddr:      env("SHARE_ADDR", ":8081"),
		PublicHost:     env("PUBLIC_HOST", "localhost"),
		PublicScheme:   env("PUBLIC_SCHEME", "http"),
		PortStart:      envInt("PORT_START", 12000),
		PortEnd:        envInt("PORT_END", 12999),
		MaxUploadBytes: int64(envInt("MAX_UPLOAD_MB", 300)) * 1024 * 1024,
		InitAdminUser:  env("INIT_ADMIN_USER", "admin"),
		RunnerStubPath: env("RUNNER_STUB_PATH", "bin/static-host-runner-windows-amd64.exe"),
	}
	cfg.InitAdminPassword = os.Getenv("INIT_ADMIN_PASSWORD")

	flag.StringVar(&cfg.DataDir, "data-dir", cfg.DataDir, "数据目录")
	flag.StringVar(&cfg.AdminAddr, "admin-addr", cfg.AdminAddr, "管理端口监听地址")
	flag.StringVar(&cfg.ShareAddr, "share-addr", cfg.ShareAddr, "分享网关监听地址")
	flag.StringVar(&cfg.PublicHost, "public-host", cfg.PublicHost, "对外访问主机名或 IP")
	flag.StringVar(&cfg.PublicScheme, "public-scheme", cfg.PublicScheme, "对外访问协议")
	flag.IntVar(&cfg.PortStart, "port-start", cfg.PortStart, "项目独立端口池起始端口")
	flag.IntVar(&cfg.PortEnd, "port-end", cfg.PortEnd, "项目独立端口池结束端口")
	maxMB := int(cfg.MaxUploadBytes / 1024 / 1024)
	flag.IntVar(&maxMB, "max-upload-mb", maxMB, "上传文件大小限制 MB")
	flag.StringVar(&cfg.InitAdminUser, "init-admin-user", cfg.InitAdminUser, "首次启动管理员用户名")
	flag.StringVar(&cfg.InitAdminPassword, "init-admin-password", cfg.InitAdminPassword, "首次启动管理员密码")
	flag.StringVar(&cfg.RunnerStubPath, "runner-stub-path", cfg.RunnerStubPath, "Windows EXE 壳程序路径")
	flag.Parse()

	cfg.MaxUploadBytes = int64(maxMB) * 1024 * 1024
	if cfg.PortEnd < cfg.PortStart {
		cfg.PortEnd = cfg.PortStart
	}
	cfg.PublicScheme = strings.TrimSuffix(cfg.PublicScheme, "://")
	return cfg
}

// env 读取字符串环境变量，未设置时返回默认值。
func env(key, fallback string) string {
	if value := strings.TrimSpace(os.Getenv(key)); value != "" {
		return value
	}
	return fallback
}

// envInt 读取整数环境变量，解析失败时返回默认值。
func envInt(key string, fallback int) int {
	value := strings.TrimSpace(os.Getenv(key))
	if value == "" {
		return fallback
	}
	parsed, err := strconv.Atoi(value)
	if err != nil {
		return fallback
	}
	return parsed
}

// SharePort 返回分享网关端口，用于生成访问地址。
func (c Config) SharePort() string {
	return portPart(c.ShareAddr, "8081")
}

// AdminPort 返回管理端口，用于生成后台地址。
func (c Config) AdminPort() string {
	return portPart(c.AdminAddr, "8080")
}

// portPart 从监听地址中提取端口，无法提取时使用默认端口。
func portPart(addr, fallback string) string {
	if idx := strings.LastIndex(addr, ":"); idx >= 0 && idx < len(addr)-1 {
		return addr[idx+1:]
	}
	return fallback
}
