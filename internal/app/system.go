// 文件功能描述：实现系统配置 API，包括本机 IP 地址发现和公开分享主机选择。
package app

import (
	"net"
	"net/http"
	"sort"
	"strings"
)

const publicHostSettingKey = "public_host"

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
			return true
		}
		if items[j] == "localhost" {
			return false
		}
		return items[i] < items[j]
	})
	return items
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
