// 文件功能描述：验证应用日志初始化的文件创建和标准输出双写行为。
package applog

import (
	"bytes"
	"log"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

// TestSetupCreatesLogFile 验证日志初始化会自动创建目录并写入日志文件。
func TestSetupCreatesLogFile(t *testing.T) {
	restoreLog(t)
	logFile := filepath.Join(t.TempDir(), "logs", "webshare.log")

	logger, err := SetupWithWriter(testConfig(logFile, false, nil))
	if err != nil {
		t.Fatalf("SetupWithWriter() error = %v", err)
	}
	log.Print("文件日志写入测试")
	if err := logger.Close(); err != nil {
		t.Fatalf("Close() error = %v", err)
	}

	data, err := os.ReadFile(logFile)
	if err != nil {
		t.Fatalf("读取日志文件失败: %v", err)
	}
	if !strings.Contains(string(data), "文件日志写入测试") {
		t.Fatalf("日志文件未包含写入内容: %s", string(data))
	}
}

// TestSetupWritesStdoutWhenEnabled 验证开启标准输出时日志会同时写入 stdout 和文件。
func TestSetupWritesStdoutWhenEnabled(t *testing.T) {
	restoreLog(t)
	logFile := filepath.Join(t.TempDir(), "logs", "webshare.log")
	var stdout bytes.Buffer

	logger, err := SetupWithWriter(testConfig(logFile, true, &stdout))
	if err != nil {
		t.Fatalf("SetupWithWriter() error = %v", err)
	}
	log.Print("双写日志测试")
	if err := logger.Close(); err != nil {
		t.Fatalf("Close() error = %v", err)
	}

	if !strings.Contains(stdout.String(), "双写日志测试") {
		t.Fatalf("stdout 未包含写入内容: %s", stdout.String())
	}
	data, err := os.ReadFile(logFile)
	if err != nil {
		t.Fatalf("读取日志文件失败: %v", err)
	}
	if !strings.Contains(string(data), "双写日志测试") {
		t.Fatalf("日志文件未包含写入内容: %s", string(data))
	}
}

// TestSetupSkipsStdoutWhenDisabled 验证关闭标准输出时只写日志文件。
func TestSetupSkipsStdoutWhenDisabled(t *testing.T) {
	restoreLog(t)
	logFile := filepath.Join(t.TempDir(), "logs", "webshare.log")
	var stdout bytes.Buffer

	logger, err := SetupWithWriter(testConfig(logFile, false, &stdout))
	if err != nil {
		t.Fatalf("SetupWithWriter() error = %v", err)
	}
	log.Print("仅文件日志测试")
	if err := logger.Close(); err != nil {
		t.Fatalf("Close() error = %v", err)
	}

	if stdout.Len() != 0 {
		t.Fatalf("stdout 不应写入内容: %s", stdout.String())
	}
}

// testConfig 生成测试使用的日志配置。
func testConfig(logFile string, stdout bool, writer *bytes.Buffer) Config {
	return Config{
		File:         logFile,
		Stdout:       stdout,
		MaxSizeMB:    10,
		MaxBackups:   5,
		MaxAgeDays:   30,
		StdoutWriter: writer,
	}
}

// restoreLog 在测试结束后恢复标准库 log 的默认输出，避免影响其他包测试。
func restoreLog(t *testing.T) {
	t.Helper()
	oldWriter := log.Writer()
	oldFlags := log.Flags()
	oldPrefix := log.Prefix()
	t.Cleanup(func() {
		log.SetOutput(oldWriter)
		log.SetFlags(oldFlags)
		log.SetPrefix(oldPrefix)
	})
}
