// 文件功能描述：读取运行配置，统一管理端口、数据目录、日志、上传限制和初始化管理员参数。
package config

import (
	"flag"
	"net"
	"os"
	"path/filepath"
	"runtime"
	"strconv"
	"strings"
)

const (
	defaultLogMaxSizeMB  = 10
	defaultLogMaxBackups = 5
	defaultLogMaxAgeDays = 30
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
	LogFile           string
	LogStdout         bool
	LogMaxSizeMB      int
	LogMaxBackups     int
	LogMaxAgeDays     int
}

// Load 从命令行和环境变量读取配置；命令行参数优先于默认值。
func Load() Config {
	return loadWithFlagSet(os.Args[1:], flag.CommandLine)
}

// loadWithFlagSet 从指定参数和环境变量读取配置，便于测试隔离全局 flag。
func loadWithFlagSet(args []string, flags *flag.FlagSet) Config {
	cfg := Config{
		DataDir:        env("DATA_DIR", "data"),
		AdminAddr:      env("ADMIN_ADDR", ":8080"),
		ShareAddr:      env("SHARE_ADDR", ":8081"),
		PublicHost:     env("PUBLIC_HOST", defaultPublicHost()),
		PublicScheme:   env("PUBLIC_SCHEME", "http"),
		PortStart:      envInt("PORT_START", 12000),
		PortEnd:        envInt("PORT_END", 12999),
		MaxUploadBytes: int64(envInt("MAX_UPLOAD_MB", 300)) * 1024 * 1024,
		InitAdminUser:  env("INIT_ADMIN_USER", "admin"),
		RunnerStubPath: env("RUNNER_STUB_PATH", "release/webshare-runner-windows-amd64.exe"),
		LogFile:        strings.TrimSpace(os.Getenv("LOG_FILE")),
		LogStdout:      envBool("LOG_STDOUT", defaultLogStdout()),
		LogMaxSizeMB:   envInt("LOG_MAX_SIZE_MB", defaultLogMaxSizeMB),
		LogMaxBackups:  envInt("LOG_MAX_BACKUPS", defaultLogMaxBackups),
		LogMaxAgeDays:  envInt("LOG_MAX_AGE_DAYS", defaultLogMaxAgeDays),
	}
	cfg.InitAdminPassword = os.Getenv("INIT_ADMIN_PASSWORD")

	flags.StringVar(&cfg.DataDir, "data-dir", cfg.DataDir, "数据目录")
	flags.StringVar(&cfg.AdminAddr, "admin-addr", cfg.AdminAddr, "管理端口监听地址")
	flags.StringVar(&cfg.ShareAddr, "share-addr", cfg.ShareAddr, "分享网关监听地址")
	flags.StringVar(&cfg.PublicHost, "public-host", cfg.PublicHost, "对外访问主机名或 IP")
	flags.StringVar(&cfg.PublicScheme, "public-scheme", cfg.PublicScheme, "对外访问协议")
	flags.IntVar(&cfg.PortStart, "port-start", cfg.PortStart, "项目独立端口池起始端口")
	flags.IntVar(&cfg.PortEnd, "port-end", cfg.PortEnd, "项目独立端口池结束端口")
	maxMB := int(cfg.MaxUploadBytes / 1024 / 1024)
	flags.IntVar(&maxMB, "max-upload-mb", maxMB, "上传文件大小限制 MB")
	flags.StringVar(&cfg.InitAdminUser, "init-admin-user", cfg.InitAdminUser, "首次启动管理员用户名")
	flags.StringVar(&cfg.InitAdminPassword, "init-admin-password", cfg.InitAdminPassword, "首次启动管理员密码")
	flags.StringVar(&cfg.RunnerStubPath, "runner-stub-path", cfg.RunnerStubPath, "Windows EXE 壳程序路径")
	flags.StringVar(&cfg.LogFile, "log-file", cfg.LogFile, "运行日志文件路径")
	flags.BoolVar(&cfg.LogStdout, "log-stdout", cfg.LogStdout, "同时输出日志到标准输出")
	flags.IntVar(&cfg.LogMaxSizeMB, "log-max-size-mb", cfg.LogMaxSizeMB, "单个日志文件最大体积 MB")
	flags.IntVar(&cfg.LogMaxBackups, "log-max-backups", cfg.LogMaxBackups, "保留的旧日志文件数量")
	flags.IntVar(&cfg.LogMaxAgeDays, "log-max-age-days", cfg.LogMaxAgeDays, "旧日志文件保留天数")
	_ = flags.Parse(args)

	cfg.MaxUploadBytes = int64(maxMB) * 1024 * 1024
	if cfg.PortEnd < cfg.PortStart {
		cfg.PortEnd = cfg.PortStart
	}
	cfg.PublicScheme = strings.TrimSuffix(cfg.PublicScheme, "://")
	cfg.LogFile = defaultLogFile(cfg.DataDir, cfg.LogFile)
	cfg.LogMaxSizeMB = positiveOrDefault(cfg.LogMaxSizeMB, defaultLogMaxSizeMB)
	cfg.LogMaxBackups = positiveOrDefault(cfg.LogMaxBackups, defaultLogMaxBackups)
	cfg.LogMaxAgeDays = positiveOrDefault(cfg.LogMaxAgeDays, defaultLogMaxAgeDays)
	return cfg
}

// defaultLogFile 返回日志文件路径，未配置时使用数据目录下的 logs/webshare.log。
func defaultLogFile(dataDir, configured string) string {
	configured = strings.TrimSpace(configured)
	if configured != "" {
		return configured
	}
	return filepath.Join(dataDir, "logs", "webshare.log")
}

// defaultLogStdout 返回当前平台默认是否输出到标准输出。
func defaultLogStdout() bool {
	return runtime.GOOS != "windows"
}

// defaultPublicHost 返回默认公开主机，优先使用第一个局域网 IPv4 地址。
func defaultPublicHost() string {
	if host := firstLANHost(); host != "" {
		return host
	}
	return "localhost"
}

// firstLANHost 按系统网卡顺序查找第一个可用的局域网 IPv4 地址。
func firstLANHost() string {
	interfaces, err := net.Interfaces()
	if err != nil {
		return ""
	}
	for _, item := range interfaces {
		if item.Flags&net.FlagUp == 0 || item.Flags&net.FlagLoopback != 0 {
			continue
		}
		addrs, err := item.Addrs()
		if err != nil {
			continue
		}
		for _, addr := range addrs {
			ip := ipFromAddr(addr)
			if isPrivateIPv4(ip) {
				return ip.String()
			}
		}
	}
	return ""
}

// ipFromAddr 从网卡地址中提取 IP。
func ipFromAddr(addr net.Addr) net.IP {
	switch value := addr.(type) {
	case *net.IPNet:
		return value.IP
	case *net.IPAddr:
		return value.IP
	default:
		return nil
	}
}

// isPrivateIPv4 判断地址是否属于常见局域网 IPv4 网段。
func isPrivateIPv4(ip net.IP) bool {
	v4 := ip.To4()
	if v4 == nil {
		return false
	}
	return v4[0] == 10 || v4[0] == 192 && v4[1] == 168 || v4[0] == 172 && v4[1] >= 16 && v4[1] <= 31
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

// envBool 读取布尔环境变量，解析失败时返回默认值。
func envBool(key string, fallback bool) bool {
	value := strings.TrimSpace(os.Getenv(key))
	if value == "" {
		return fallback
	}
	parsed, err := strconv.ParseBool(value)
	if err != nil {
		return fallback
	}
	return parsed
}

// positiveOrDefault 对日志轮转参数做保底，避免 0 或负数禁用保护。
func positiveOrDefault(value, fallback int) int {
	if value <= 0 {
		return fallback
	}
	return value
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
