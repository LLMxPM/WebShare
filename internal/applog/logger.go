// 文件功能描述：初始化应用运行日志输出，统一支持标准输出和滚动日志文件。
package applog

import (
	"io"
	"log"
	"os"
	"path/filepath"
	"strings"

	"gopkg.in/natefinch/lumberjack.v2"
)

// Config 描述日志输出和轮转策略。
type Config struct {
	File         string
	Stdout       bool
	MaxSizeMB    int
	MaxBackups   int
	MaxAgeDays   int
	StdoutWriter io.Writer
}

// Logger 保存需要在进程退出时关闭的日志资源。
type Logger struct {
	file *lumberjack.Logger
}

// Setup 配置标准库 log 输出到指定文件，并按需同步输出到标准输出。
func Setup(cfg Config) (*Logger, error) {
	cfg.StdoutWriter = os.Stdout
	return SetupWithWriter(cfg)
}

// SetupWithWriter 配置标准库 log 输出，测试可传入自定义标准输出 writer。
func SetupWithWriter(cfg Config) (*Logger, error) {
	logFile := strings.TrimSpace(cfg.File)
	if logFile == "" {
		logFile = filepath.Join("data", "logs", "webshare.log")
	}
	if err := os.MkdirAll(filepath.Dir(logFile), 0o755); err != nil {
		return nil, err
	}
	rotator := &lumberjack.Logger{
		Filename:   logFile,
		MaxSize:    cfg.MaxSizeMB,
		MaxBackups: cfg.MaxBackups,
		MaxAge:     cfg.MaxAgeDays,
		LocalTime:  true,
	}
	writers := []io.Writer{rotator}
	if cfg.Stdout {
		stdout := cfg.StdoutWriter
		if stdout == nil {
			stdout = os.Stdout
		}
		writers = append([]io.Writer{stdout}, writers...)
	}
	log.SetFlags(log.LstdFlags)
	log.SetOutput(io.MultiWriter(writers...))
	return &Logger{file: rotator}, nil
}

// Close 关闭日志文件句柄，让退出前的日志尽量落盘。
func (l *Logger) Close() error {
	if l == nil || l.file == nil {
		return nil
	}
	return l.file.Close()
}
