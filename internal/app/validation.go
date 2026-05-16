// 文件功能描述：校验项目 slug、挂载路径、分享状态和访问模式，集中处理路径冲突规则。
package app

import (
	"crypto/rand"
	"errors"
	"regexp"
	"strings"
	"time"

	"webshare/internal/model"
)

var slugRe = regexp.MustCompile(`^[a-zA-Z0-9][a-zA-Z0-9-]{1,62}[a-zA-Z0-9]$`)

var reservedPaths = []string{"/api/", "/admin/", "/p/", "/assets/", "/healthz/"}

var reservedWords = map[string]bool{
	"api": true, "admin": true, "p": true, "assets": true, "healthz": true,
}

// validateSlug 校验项目 slug 格式、保留词和唯一性。
func (a *App) validateSlug(slug string, excludeID int64) error {
	slug = strings.TrimSpace(slug)
	if !slugRe.MatchString(slug) {
		return errors.New("slug 只能包含字母、数字和短横线，长度 3-64，且首尾必须是字母或数字")
	}
	if reservedWords[strings.ToLower(slug)] {
		return errors.New("slug 不能使用系统保留词")
	}
	exists, err := a.store.SlugExists(slug, excludeID)
	if err != nil {
		return err
	}
	if exists {
		return errors.New("slug 已被占用")
	}
	return nil
}

// generateUniqueSlug 生成日期加随机码形式的唯一 slug，例如 20260516-a1b2c3。
func (a *App) generateUniqueSlug(name string) (string, error) {
	datePrefix := time.Now().Format("20060102")
	for i := 0; i < 1000; i++ {
		code, err := randomSlugCode(6)
		if err != nil {
			return "", err
		}
		candidate := datePrefix + "-" + code
		exists, err := a.store.SlugExists(candidate, 0)
		if err != nil {
			return "", err
		}
		if !exists && !reservedWords[candidate] {
			return candidate, nil
		}
	}
	return "", errors.New("无法生成唯一项目标识")
}

// randomSlugCode 生成指定长度的小写字母数字随机码。
func randomSlugCode(length int) (string, error) {
	const alphabet = "abcdefghijklmnopqrstuvwxyz0123456789"
	raw := make([]byte, length)
	if _, err := rand.Read(raw); err != nil {
		return "", err
	}
	var b strings.Builder
	for _, item := range raw {
		b.WriteByte(alphabet[int(item)%len(alphabet)])
	}
	return b.String(), nil
}

// validateMountPath 校验自定义挂载路径格式和系统保留路径。
func (a *App) validateMountPath(mountPath string) error {
	if mountPath == "" {
		return nil
	}
	if !strings.HasPrefix(mountPath, "/") || !strings.HasSuffix(mountPath, "/") {
		return errors.New("挂载路径必须以 / 开头并以 / 结尾")
	}
	if strings.Contains(mountPath, "..") || strings.Contains(mountPath, "//") {
		return errors.New("挂载路径包含非法片段")
	}
	for _, reserved := range reservedPaths {
		if mountPath == reserved || strings.HasPrefix(mountPath, reserved) || strings.HasPrefix(reserved, mountPath) {
			return errors.New("挂载路径与系统保留路径冲突")
		}
	}
	return nil
}

// validateActiveMountPath 校验激活挂载项目之间的路径冲突。
func (a *App) validateActiveMountPath(mountPath string, excludeID int64) error {
	if err := a.validateMountPath(mountPath); err != nil {
		return err
	}
	conflict, existing, err := a.store.MountPathConflict(mountPath, excludeID)
	if err != nil {
		return err
	}
	if conflict {
		return errors.New("挂载路径与已有项目冲突: " + existing)
	}
	return nil
}

// normalizeShareState 规范化分享状态，空值默认公开。
func normalizeShareState(value string) (string, error) {
	switch strings.TrimSpace(value) {
	case "", model.SharePublic:
		return model.SharePublic, nil
	case model.ShareToken:
		return model.ShareToken, nil
	case model.ShareUnshared:
		return model.ShareUnshared, nil
	default:
		return "", errors.New("分享状态必须是 public、share 或 unshared")
	}
}

// normalizeAccessMode 规范化访问模式，空值默认路径模式。
func normalizeAccessMode(value string) (string, error) {
	switch strings.TrimSpace(value) {
	case "", model.AccessPath:
		return model.AccessPath, nil
	case model.AccessMount:
		return model.AccessMount, nil
	case model.AccessPort:
		return model.AccessPort, nil
	default:
		return "", errors.New("访问模式必须是 path、mount 或 port")
	}
}
