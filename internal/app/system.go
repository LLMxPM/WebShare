// 文件功能描述：实现系统配置 API，包括本机 IP 地址发现、公开分享主机和端口配置。
package app

import (
	"encoding/json"
	"errors"
	"net"
	"net/http"
	"sort"
	"strconv"
	"strings"

	"webshare/internal/config"
	"webshare/internal/store"
)

const (
	publicHostSettingKey       = "public_host"
	sharePortSettingKey        = "share_gateway_port"
	projectPortStartSettingKey = "project_port_start"
	projectPortEndSettingKey   = "project_port_end"
	defaultShareGatewayPort    = 8081
	defaultProjectPortStart    = 12000
	defaultProjectPortEnd      = 12999
)

type networkSettings struct {
	SharePort int `json:"sharePort"`
	PortStart int `json:"portStart"`
	PortEnd   int `json:"portEnd"`
}

type networkSettingsDTO struct {
	SharePort       int  `json:"sharePort"`
	PortStart       int  `json:"portStart"`
	PortEnd         int  `json:"portEnd"`
	ActiveSharePort int  `json:"activeSharePort"`
	ActivePortStart int  `json:"activePortStart"`
	ActivePortEnd   int  `json:"activePortEnd"`
	RestartRequired bool `json:"restartRequired"`
}

// handleSystem 分发系统配置接口，仅管理员可访问。
func (a *App) handleSystem(w http.ResponseWriter, r *http.Request, tail string) {
	if !requireAdmin(w, r) {
		return
	}
	tail = strings.Trim(tail, "/")
	switch {
	case tail == "public-host" && r.Method == http.MethodGet:
		a.handleGetPublicHost(w, r)
	case tail == "public-host" && r.Method == http.MethodPatch:
		a.handleSetPublicHost(w, r)
	case tail == "network" && r.Method == http.MethodGet:
		a.handleGetNetworkSettings(w, r)
	case tail == "network" && r.Method == http.MethodPatch:
		a.handleSetNetworkSettings(w, r)
	default:
		writeError(w, http.StatusNotFound, "接口不存在")
	}
}

// handleGetPublicHost 返回当前公开主机和本机候选地址。
func (a *App) handleGetPublicHost(w http.ResponseWriter, r *http.Request) {
	current := a.publicHost()
	writeJSON(w, http.StatusOK, map[string]any{
		"publicHost": current,
		"candidates": a.publicHostCandidates(current),
	})
}

// handleSetPublicHost 保存管理员选择的公开分享主机。
func (a *App) handleSetPublicHost(w http.ResponseWriter, r *http.Request) {
	var req struct {
		PublicHost string `json:"publicHost"`
	}
	if err := readJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "请求格式错误")
		return
	}
	host := normalizePublicHost(req.PublicHost)
	if host == "" {
		writeError(w, http.StatusBadRequest, "公开主机不能为空")
		return
	}
	if err := a.store.SetSetting(publicHostSettingKey, host); err != nil {
		writeError(w, http.StatusInternalServerError, "保存公开主机失败")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"publicHost": host,
		"candidates": a.publicHostCandidates(host),
	})
}

// handleGetNetworkSettings 返回当前运行端口和已保存的下次启动端口配置。
func (a *App) handleGetNetworkSettings(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, map[string]any{"network": a.networkSettingsDTO()})
}

// handleSetNetworkSettings 保存下次启动生效的分享网关端口和独立端口段。
func (a *App) handleSetNetworkSettings(w http.ResponseWriter, r *http.Request) {
	var req networkSettings
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "请求格式错误")
		return
	}
	if err := validateNetworkSettings(req); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	if err := a.store.SetSetting(sharePortSettingKey, strconv.Itoa(req.SharePort)); err != nil {
		writeError(w, http.StatusInternalServerError, "保存分享网关端口失败")
		return
	}
	if err := a.store.SetSetting(projectPortStartSettingKey, strconv.Itoa(req.PortStart)); err != nil {
		writeError(w, http.StatusInternalServerError, "保存独立端口起点失败")
		return
	}
	if err := a.store.SetSetting(projectPortEndSettingKey, strconv.Itoa(req.PortEnd)); err != nil {
		writeError(w, http.StatusInternalServerError, "保存独立端口终点失败")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"network": a.networkSettingsDTO()})
}

// publicHost 返回数据库设置的公开主机，未设置时回退到启动配置。
func (a *App) publicHost() string {
	value, err := a.store.GetSetting(publicHostSettingKey)
	if err == nil && strings.TrimSpace(value) != "" {
		return normalizePublicHost(value)
	}
	return normalizePublicHost(a.cfg.PublicHost)
}

// publicHostCandidates 枚举本机地址并补充当前配置和 localhost。
func (a *App) publicHostCandidates(current string) []string {
	set := map[string]bool{}
	addCandidate(set, "localhost")
	addCandidate(set, normalizePublicHost(a.cfg.PublicHost))
	addCandidate(set, current)
	interfaces, _ := net.Interfaces()
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
			if ip == nil || ip.IsLoopback() || ip.IsUnspecified() {
				continue
			}
			addCandidate(set, ip.String())
		}
	}
	items := make([]string, 0, len(set))
	for item := range set {
		items = append(items, item)
	}
	sort.Slice(items, func(i, j int) bool {
		if items[i] == current {
			return true
		}
		if items[j] == current {
			return false
		}
		if items[i] == "localhost" {
			return false
		}
		if items[j] == "localhost" {
			return true
		}
		return items[i] < items[j]
	})
	return items
}

// applySavedNetworkConfig 将数据库中的端口配置应用到启动配置，供重启后生效。
func applySavedNetworkConfig(cfg *config.Config, db *store.Store) {
	settings := savedNetworkSettings(*cfg, db)
	cfg.ShareAddr = replaceAddrPort(cfg.ShareAddr, settings.SharePort)
	cfg.PortStart = settings.PortStart
	cfg.PortEnd = settings.PortEnd
}

// networkSettingsDTO 组装端口配置响应，区分当前运行值和下次启动值。
func (a *App) networkSettingsDTO() networkSettingsDTO {
	active := activeNetworkSettings(a.cfg)
	saved := savedNetworkSettings(a.cfg, a.store)
	return networkSettingsDTO{
		SharePort:       saved.SharePort,
		PortStart:       saved.PortStart,
		PortEnd:         saved.PortEnd,
		ActiveSharePort: active.SharePort,
		ActivePortStart: active.PortStart,
		ActivePortEnd:   active.PortEnd,
		RestartRequired: saved != active,
	}
}

// savedNetworkSettings 读取已保存的下次启动端口配置，缺省时使用当前运行配置。
func savedNetworkSettings(cfg config.Config, db *store.Store) networkSettings {
	settings := activeNetworkSettings(cfg)
	if value, ok := settingPort(db, sharePortSettingKey); ok {
		settings.SharePort = value
	}
	if value, ok := settingPort(db, projectPortStartSettingKey); ok {
		settings.PortStart = value
	}
	if value, ok := settingPort(db, projectPortEndSettingKey); ok {
		settings.PortEnd = value
	}
	if settings.PortEnd < settings.PortStart {
		settings.PortEnd = settings.PortStart
	}
	return settings
}

// activeNetworkSettings 返回当前进程正在使用的端口配置。
func activeNetworkSettings(cfg config.Config) networkSettings {
	return networkSettings{
		SharePort: configPort(cfg.SharePort(), defaultShareGatewayPort),
		PortStart: configPort(strconv.Itoa(cfg.PortStart), defaultProjectPortStart),
		PortEnd:   configPort(strconv.Itoa(cfg.PortEnd), defaultProjectPortEnd),
	}
}

// settingPort 从数据库读取端口值，缺失或非法时返回 false。
func settingPort(db *store.Store, key string) (int, bool) {
	value, err := db.GetSetting(key)
	if err != nil {
		return 0, false
	}
	port := configPort(value, 0)
	return port, port > 0
}

// configPort 解析端口号，非法时返回 fallback。
func configPort(value string, fallback int) int {
	port, err := strconv.Atoi(strings.TrimSpace(value))
	if err != nil || port < 1 || port > 65535 {
		return fallback
	}
	return port
}

// validateNetworkSettings 校验分享网关端口和独立端口段。
func validateNetworkSettings(settings networkSettings) error {
	if !validPort(settings.SharePort) {
		return errors.New("分享网关端口必须在 1-65535 之间")
	}
	if !validPort(settings.PortStart) || !validPort(settings.PortEnd) {
		return errors.New("独立端口段必须在 1-65535 之间")
	}
	if settings.PortStart > settings.PortEnd {
		return errors.New("独立端口起点不能大于终点")
	}
	if settings.SharePort >= settings.PortStart && settings.SharePort <= settings.PortEnd {
		return errors.New("分享网关端口不能位于独立端口段内")
	}
	return nil
}

// validPort 判断端口是否处于 TCP/UDP 合法端口范围。
func validPort(port int) bool {
	return port >= 1 && port <= 65535
}

// replaceAddrPort 替换监听地址中的端口，并保留原监听主机。
func replaceAddrPort(addr string, port int) string {
	portText := strconv.Itoa(port)
	addr = strings.TrimSpace(addr)
	if addr == "" || strings.HasPrefix(addr, ":") {
		return ":" + portText
	}
	if host, _, err := net.SplitHostPort(addr); err == nil {
		return net.JoinHostPort(host, portText)
	}
	host := strings.Trim(addr, "[]")
	return net.JoinHostPort(host, portText)
}

// normalizePublicHost 去掉协议、路径和端口，只保留主机名或 IP。
func normalizePublicHost(value string) string {
	value = strings.TrimSpace(value)
	value = strings.TrimPrefix(value, "http://")
	value = strings.TrimPrefix(value, "https://")
	value = strings.Trim(value, "/")
	if host, _, err := net.SplitHostPort(value); err == nil {
		value = host
	}
	if idx := strings.Index(value, "/"); idx >= 0 {
		value = value[:idx]
	}
	value = strings.Trim(value, "[]")
	return value
}

// addCandidate 向候选集合加入非空地址。
func addCandidate(set map[string]bool, value string) {
	value = normalizePublicHost(value)
	if value != "" {
		set[value] = true
	}
}

// ipFromAddr 从网卡地址中提取 IP。
func ipFromAddr(addr net.Addr) net.IP {
	switch v := addr.(type) {
	case *net.IPNet:
		return v.IP
	case *net.IPAddr:
		return v.IP
	default:
		return nil
	}
}
