// 文件功能描述：识别静态前端产物的主 base URL、访问模式建议和路径风险。
package analyzer

import (
	"os"
	"path/filepath"
	"regexp"
	"sort"
	"strings"

	"webshare/internal/model"
)

var (
	baseRe      = regexp.MustCompile(`(?is)<base[^>]+href=["']([^"']+)["']`)
	attrPathRe  = regexp.MustCompile(`(?is)\s(?:src|href)=["']([^"']+)["']`)
	cssURLRe    = regexp.MustCompile(`(?is)url\(["']?(/[^"')]+)["']?\)`)
	fetchRiskRe = regexp.MustCompile(`(?is)\b(fetch|axios\.[a-z]+)\(\s*["']/api/`)
)

// Analyze 扫描项目入口和少量资源文件，返回主 base URL 和兼容性提示。
func Analyze(root, entryFile string) model.BaseAnalysis {
	if entryFile == "" {
		entryFile = "index.html"
	}
	htmlPath := filepath.Join(root, filepath.FromSlash(entryFile))
	content, err := os.ReadFile(htmlPath)
	if err != nil {
		return model.BaseAnalysis{
			BaseKind:        model.BaseUnknown,
			DetectedBaseURL: "",
			RecommendedMode: model.AccessPath,
			Warnings:        []string{"未找到入口文件，无法识别 base URL"},
		}
	}

	html := string(content)
	analysis := model.BaseAnalysis{FileProbeOK: true}
	if base := firstMatch(baseRe, html); base != "" {
		applyBase(&analysis, root, []string{base}, true)
	} else {
		paths := collectHTMLAssetPaths(html)
		applyBase(&analysis, root, inferBases(paths), false)
	}
	analysis.Warnings = append(analysis.Warnings, riskWarnings(root, html)...)
	analysis.Warnings = uniqueStrings(analysis.Warnings)
	if analysis.Warnings == nil {
		analysis.Warnings = []string{}
	}
	if analysis.Candidates == nil {
		analysis.Candidates = []string{}
	}
	return analysis
}

// firstMatch 返回正则第一个捕获组。
func firstMatch(re *regexp.Regexp, input string) string {
	match := re.FindStringSubmatch(input)
	if len(match) < 2 {
		return ""
	}
	return strings.TrimSpace(match[1])
}

// collectHTMLAssetPaths 提取入口 HTML 中主 JS/CSS/图标等本地资源路径。
func collectHTMLAssetPaths(html string) []string {
	matches := attrPathRe.FindAllStringSubmatch(html, -1)
	var paths []string
	for _, match := range matches {
		if len(match) < 2 {
			continue
		}
		value := strings.TrimSpace(match[1])
		if value == "" || strings.HasPrefix(value, "http://") || strings.HasPrefix(value, "https://") || strings.HasPrefix(value, "//") || strings.HasPrefix(value, "data:") {
			continue
		}
		paths = append(paths, value)
	}
	return paths
}

// inferBases 根据入口资源路径推断主静态资源 base。
func inferBases(paths []string) []string {
	if len(paths) == 0 {
		return []string{"."}
	}
	set := map[string]bool{}
	for _, path := range paths {
		path = strings.TrimSpace(path)
		if path == "" {
			continue
		}
		if strings.HasPrefix(path, "./") || !strings.HasPrefix(path, "/") {
			set["."] = true
			continue
		}
		set[inferAbsoluteBase(path)] = true
	}
	return mapKeys(set)
}

// inferAbsoluteBase 从绝对资源路径中识别根路径或固定前缀。
func inferAbsoluteBase(path string) string {
	cleaned := "/" + strings.TrimLeft(path, "/")
	parts := strings.Split(strings.Trim(cleaned, "/"), "/")
	if len(parts) == 0 || parts[0] == "" {
		return "/"
	}
	if looksRootAsset(parts[0]) {
		return "/"
	}
	return "/" + parts[0] + "/"
}

// looksRootAsset 判断首段是否像根路径静态资源目录或文件。
func looksRootAsset(segment string) bool {
	known := map[string]bool{
		"assets": true, "asset": true, "static": true, "js": true, "css": true, "img": true,
		"images": true, "fonts": true, "font": true, "media": true, "favicon.ico": true,
		"manifest.json": true, "manifest.webmanifest": true, "sw.js": true,
	}
	return known[strings.ToLower(segment)]
}

// applyBase 根据候选 base URL 设置识别结果和推荐访问模式。
func applyBase(analysis *model.BaseAnalysis, root string, candidates []string, explicitBase bool) {
	candidates = normalizeCandidates(candidates)
	analysis.Candidates = candidates
	if len(candidates) == 0 {
		analysis.BaseKind = model.BaseUnknown
		analysis.RecommendedMode = model.AccessPath
		analysis.DetectedBaseURL = ""
		return
	}
	if len(candidates) > 1 {
		analysis.BaseKind = model.BaseMultiple
		analysis.DetectedBaseURL = strings.Join(candidates, ",")
		analysis.RecommendedMode = model.AccessPort
		analysis.FileProbeOK = probeCandidates(root, candidates)
		analysis.Warnings = append(analysis.Warnings, "识别到多个根路径前缀，建议使用独立端口模式")
		if !analysis.FileProbeOK {
			analysis.Warnings = append(analysis.Warnings, "部分根路径前缀无法在项目文件中命中，可能需要重新构建")
		}
		return
	}

	base := candidates[0]
	analysis.DetectedBaseURL = base
	switch {
	case base == "." || base == "./" || base == "":
		analysis.BaseKind = model.BaseRelative
		analysis.DetectedBaseURL = "."
		analysis.RecommendedMode = model.AccessPath
	case base == "/":
		analysis.BaseKind = model.BaseRoot
		analysis.RecommendedMode = model.AccessPort
		analysis.Warnings = append(analysis.Warnings, "项目依赖站点根路径，建议启用独立端口")
	case strings.HasPrefix(base, "/"):
		analysis.BaseKind = model.BaseFixed
		analysis.RecommendedMode = model.AccessMount
		analysis.RecommendedMount = ensureSlash(base)
	default:
		analysis.BaseKind = model.BaseUnknown
		analysis.RecommendedMode = model.AccessPath
	}
	if explicitBase {
		analysis.Warnings = append(analysis.Warnings, "入口文件声明了 base href，系统仅识别不改写")
	}
}

// normalizeCandidates 清理候选 base URL 并排除外部地址。
func normalizeCandidates(candidates []string) []string {
	set := map[string]bool{}
	for _, item := range candidates {
		item = strings.TrimSpace(item)
		if item == "" {
			continue
		}
		if strings.HasPrefix(item, "http://") || strings.HasPrefix(item, "https://") || strings.HasPrefix(item, "//") {
			set[item] = true
			continue
		}
		if item == "." || item == "./" {
			set["."] = true
			continue
		}
		if strings.HasPrefix(item, "/") {
			set[ensureSlash(item)] = true
			continue
		}
		set["."] = true
	}
	return mapKeys(set)
}

// riskWarnings 扫描 CSS、manifest、service worker 和常见 API 根路径风险。
func riskWarnings(root, html string) []string {
	var warnings []string
	if strings.Contains(strings.ToLower(html), "serviceworker") || strings.Contains(strings.ToLower(html), "service-worker") {
		warnings = append(warnings, "检测到 service worker 相关代码，作用域可能依赖部署路径")
	}
	if strings.Contains(strings.ToLower(html), "manifest") {
		warnings = append(warnings, "检测到 manifest 引用，请确认资源路径和作用域")
	}
	if fetchRiskRe.MatchString(html) {
		warnings = append(warnings, "检测到根路径 /api 请求，系统不会代理后端接口")
	}
	_ = filepath.WalkDir(root, func(path string, d os.DirEntry, err error) error {
		if err != nil || d.IsDir() {
			return nil
		}
		ext := strings.ToLower(filepath.Ext(path))
		if ext != ".css" && ext != ".js" {
			return nil
		}
		info, err := d.Info()
		if err != nil || info.Size() > 512*1024 {
			return nil
		}
		raw, err := os.ReadFile(path)
		if err != nil {
			return nil
		}
		text := string(raw)
		if ext == ".css" && cssURLRe.MatchString(text) {
			warnings = append(warnings, "CSS 中存在根路径 url(...)，路径型访问可能异常")
		}
		if ext == ".js" && fetchRiskRe.MatchString(text) {
			warnings = append(warnings, "JS 中存在根路径 /api 请求，系统不会代理后端接口")
		}
		return nil
	})
	return warnings
}

// probeCandidates 检查多个根路径前缀是否能在项目目录中命中。
func probeCandidates(root string, candidates []string) bool {
	for _, candidate := range candidates {
		if candidate == "/" || candidate == "." {
			continue
		}
		rel := strings.Trim(candidate, "/")
		if rel == "" {
			continue
		}
		if _, err := os.Stat(filepath.Join(root, filepath.FromSlash(rel))); err != nil {
			return false
		}
	}
	return true
}

// ensureSlash 确保绝对 base URL 以斜杠开头和结尾。
func ensureSlash(value string) string {
	value = "/" + strings.Trim(value, "/") + "/"
	if value == "//" {
		return "/"
	}
	return value
}

// mapKeys 返回 map 的排序 key 列表。
func mapKeys(set map[string]bool) []string {
	keys := make([]string, 0, len(set))
	for key := range set {
		keys = append(keys, key)
	}
	sort.Strings(keys)
	return keys
}

// uniqueStrings 对字符串切片去重并保持首次出现顺序。
func uniqueStrings(items []string) []string {
	seen := map[string]bool{}
	var result []string
	for _, item := range items {
		item = strings.TrimSpace(item)
		if item == "" || seen[item] {
			continue
		}
		seen[item] = true
		result = append(result, item)
	}
	return result
}
