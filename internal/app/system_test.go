// 文件功能描述：验证系统公开主机候选地址的排序规则。
package app

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"webshare/internal/config"
	"webshare/internal/store"
)

// TestPublicHostCandidatesPreferCurrentAndKeepLocalhostLast 验证当前主机优先且 localhost 不抢在局域网地址前。
func TestPublicHostCandidatesPreferCurrentAndKeepLocalhostLast(t *testing.T) {
	app := &App{cfg: config.Config{PublicHost: "192.168.1.20"}}
	candidates := app.publicHostCandidates("192.168.1.20")
	if len(candidates) < 2 {
		t.Fatalf("候选地址过少: %#v", candidates)
	}
	if candidates[0] != "192.168.1.20" {
		t.Fatalf("第一个候选地址 = %s, want 192.168.1.20", candidates[0])
	}
	if candidates[len(candidates)-1] != "localhost" {
		t.Fatalf("最后一个候选地址 = %s, want localhost; all=%#v", candidates[len(candidates)-1], candidates)
	}
}

// TestNetworkSettingsRequireRestart 验证端口配置保存后当前进程不变，重启创建应用后才应用。
func TestNetworkSettingsRequireRestart(t *testing.T) {
	dataDir := t.TempDir()
	app, err := New(config.Config{
		DataDir:           dataDir,
		ShareAddr:         ":8081",
		PublicHost:        "192.168.1.20",
		PublicScheme:      "http",
		PortStart:         12000,
		PortEnd:           12010,
		InitAdminUser:     "admin",
		InitAdminPassword: "password-for-test",
	})
	if err != nil {
		t.Fatal(err)
	}

	recorder := httptest.NewRecorder()
	request := accountJSONRequest(t, http.MethodPatch, "/api/system/network", networkSettings{SharePort: 9090, PortStart: 13000, PortEnd: 13010})
	app.handleSetNetworkSettings(recorder, request)
	if recorder.Code != http.StatusOK {
		t.Fatalf("保存端口配置状态码 = %d, body %s", recorder.Code, recorder.Body.String())
	}
	var response struct {
		Network networkSettingsDTO `json:"network"`
	}
	if err := json.Unmarshal(recorder.Body.Bytes(), &response); err != nil {
		t.Fatal(err)
	}
	if !response.Network.RestartRequired {
		t.Fatal("expected restartRequired after saving different ports")
	}
	if app.cfg.SharePort() != "8081" || app.cfg.PortStart != 12000 || app.cfg.PortEnd != 12010 {
		t.Fatalf("当前进程配置不应立即变化: %+v", app.cfg)
	}
	if err := app.store.Close(); err != nil {
		t.Fatal(err)
	}

	restarted, err := New(config.Config{
		DataDir:           dataDir,
		ShareAddr:         ":8081",
		PublicHost:        "192.168.1.20",
		PublicScheme:      "http",
		PortStart:         12000,
		PortEnd:           12010,
		InitAdminUser:     "admin",
		InitAdminPassword: "password-for-test",
	})
	if err != nil {
		t.Fatal(err)
	}
	defer restarted.store.Close()
	if restarted.cfg.SharePort() != "9090" || restarted.cfg.PortStart != 13000 || restarted.cfg.PortEnd != 13010 {
		t.Fatalf("重启后配置未应用: share=%s range=%d-%d", restarted.cfg.SharePort(), restarted.cfg.PortStart, restarted.cfg.PortEnd)
	}
	if restarted.networkSettingsDTO().RestartRequired {
		t.Fatal("重启应用已加载保存配置后不应再提示需要重启")
	}
}

// TestApplySavedNetworkConfigPreservesShareAddrHost 验证应用保存端口时保留分享网关监听主机。
func TestApplySavedNetworkConfigPreservesShareAddrHost(t *testing.T) {
	db, err := store.Open(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	if err := db.SetSetting(sharePortSettingKey, "9090"); err != nil {
		t.Fatal(err)
	}
	cfg := config.Config{ShareAddr: "127.0.0.1:8081", PortStart: 12000, PortEnd: 12010}
	applySavedNetworkConfig(&cfg, db)
	if cfg.ShareAddr != "127.0.0.1:9090" {
		t.Fatalf("ShareAddr = %s, want 127.0.0.1:9090", cfg.ShareAddr)
	}
}

// TestValidateNetworkSettingsRejectsOverlap 验证分享网关端口不能和独立端口段重叠。
func TestValidateNetworkSettingsRejectsOverlap(t *testing.T) {
	if err := validateNetworkSettings(networkSettings{SharePort: 12000, PortStart: 12000, PortEnd: 12010}); err == nil {
		t.Fatal("expected overlapping share port to be rejected")
	}
}
