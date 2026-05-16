// 文件功能描述：验证运行配置中的默认公开主机和日志参数解析规则。
package config

import (
	"flag"
	"net"
	"path/filepath"
	"testing"
)

// TestIsPrivateIPv4 验证只把常见私有 IPv4 网段作为默认局域网地址候选。
func TestIsPrivateIPv4(t *testing.T) {
	cases := []struct {
		ip   string
		want bool
	}{
		{ip: "10.0.0.2", want: true},
		{ip: "172.16.1.2", want: true},
		{ip: "172.31.255.2", want: true},
		{ip: "192.168.1.2", want: true},
		{ip: "172.32.1.2", want: false},
		{ip: "127.0.0.1", want: false},
		{ip: "8.8.8.8", want: false},
		{ip: "fe80::1", want: false},
	}
	for _, tc := range cases {
		t.Run(tc.ip, func(t *testing.T) {
			if got := isPrivateIPv4(net.ParseIP(tc.ip)); got != tc.want {
				t.Fatalf("isPrivateIPv4(%s) = %v, want %v", tc.ip, got, tc.want)
			}
		})
	}
}

// TestLogFileDefaultsToDataDir 验证未显式配置日志文件时默认落到数据目录下。
func TestLogFileDefaultsToDataDir(t *testing.T) {
	dataDir := filepath.Join(t.TempDir(), "custom-data")
	t.Setenv("DATA_DIR", dataDir)
	t.Setenv("LOG_FILE", "")

	cfg := loadWithFlagSet(nil, flag.NewFlagSet("test", flag.ContinueOnError))

	want := filepath.Join(dataDir, "logs", "webshare.log")
	if cfg.LogFile != want {
		t.Fatalf("LogFile = %q, want %q", cfg.LogFile, want)
	}
}

// TestLogFileUsesExplicitValue 验证显式日志路径优先于默认数据目录路径。
func TestLogFileUsesExplicitValue(t *testing.T) {
	logFile := filepath.Join(t.TempDir(), "runtime.log")
	t.Setenv("DATA_DIR", filepath.Join(t.TempDir(), "data"))
	t.Setenv("LOG_FILE", logFile)

	cfg := loadWithFlagSet(nil, flag.NewFlagSet("test", flag.ContinueOnError))

	if cfg.LogFile != logFile {
		t.Fatalf("LogFile = %q, want %q", cfg.LogFile, logFile)
	}
}

// TestInvalidLogRotationFallsBackToDefaults 验证非法日志轮转参数会回退默认值。
func TestInvalidLogRotationFallsBackToDefaults(t *testing.T) {
	t.Setenv("LOG_MAX_SIZE_MB", "invalid")
	t.Setenv("LOG_MAX_BACKUPS", "0")
	t.Setenv("LOG_MAX_AGE_DAYS", "-1")

	cfg := loadWithFlagSet(nil, flag.NewFlagSet("test", flag.ContinueOnError))

	if cfg.LogMaxSizeMB != defaultLogMaxSizeMB {
		t.Fatalf("LogMaxSizeMB = %d, want %d", cfg.LogMaxSizeMB, defaultLogMaxSizeMB)
	}
	if cfg.LogMaxBackups != defaultLogMaxBackups {
		t.Fatalf("LogMaxBackups = %d, want %d", cfg.LogMaxBackups, defaultLogMaxBackups)
	}
	if cfg.LogMaxAgeDays != defaultLogMaxAgeDays {
		t.Fatalf("LogMaxAgeDays = %d, want %d", cfg.LogMaxAgeDays, defaultLogMaxAgeDays)
	}
}
