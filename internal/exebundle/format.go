// 文件功能描述：定义静态页面 EXE 资源包格式，并提供尾部元数据读写工具。
package exebundle

import (
	"encoding/binary"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"os"
	"strings"
	"time"
)

const (
	// SchemaVersion 是资源包格式版本。
	SchemaVersion = 1
	// Magic 是追加在 EXE 文件末尾的资源包识别标记。
	Magic = "SHBUNDLE_V1"
)

// Manifest 描述壳程序运行静态项目所需的入口和路径配置。
type Manifest struct {
	SchemaVersion int       `json:"schemaVersion"`
	Name          string    `json:"name"`
	EntryFile     string    `json:"entryFile"`
	BasePath      string    `json:"basePath"`
	OpenPath      string    `json:"openPath"`
	SPAEnabled    bool      `json:"spaEnabled"`
	CreatedAt     time.Time `json:"createdAt"`
}

// Footer 描述资源包各段在最终 EXE 文件中的绝对偏移。
type Footer struct {
	SchemaVersion  int    `json:"schemaVersion"`
	ZipOffset      uint64 `json:"zipOffset"`
	ZipSize        uint64 `json:"zipSize"`
	ManifestOffset uint64 `json:"manifestOffset"`
	ManifestSize   uint64 `json:"manifestSize"`
	ZipSHA256      string `json:"zipSha256"`
}

// NormalizeBasePath 将发布识别出的 base URL 转换为壳服务使用的挂载路径。
func NormalizeBasePath(value string) string {
	value = strings.TrimSpace(value)
	if value == "" || value == "." || value == "./" {
		return "/"
	}
	if strings.HasPrefix(value, "/") {
		return ensureSlash(value)
	}
	return "/"
}

// WriteTrailer 将 footer、footer 长度和 magic 写入最终 EXE 尾部。
func WriteTrailer(w io.Writer, footer Footer) error {
	raw, err := json.Marshal(footer)
	if err != nil {
		return err
	}
	if len(raw) > int(^uint32(0)) {
		return errors.New("footer 过大")
	}
	if _, err := w.Write(raw); err != nil {
		return err
	}
	var size [4]byte
	binary.LittleEndian.PutUint32(size[:], uint32(len(raw)))
	if _, err := w.Write(size[:]); err != nil {
		return err
	}
	_, err = w.Write([]byte(Magic))
	return err
}

// ReadMetadata 从已追加资源包的 EXE 文件尾部读取 footer 和 manifest。
func ReadMetadata(file *os.File) (Footer, Manifest, error) {
	var footer Footer
	var manifest Manifest
	info, err := file.Stat()
	if err != nil {
		return footer, manifest, err
	}
	tailSize := int64(4 + len(Magic))
	if info.Size() < tailSize {
		return footer, manifest, errors.New("文件不包含资源包尾部")
	}
	tail := make([]byte, tailSize)
	if _, err := file.ReadAt(tail, info.Size()-tailSize); err != nil {
		return footer, manifest, err
	}
	if string(tail[4:]) != Magic {
		return footer, manifest, errors.New("未找到 EXE 资源包标记")
	}
	footerSize := int64(binary.LittleEndian.Uint32(tail[:4]))
	footerOffset := info.Size() - tailSize - footerSize
	if footerSize <= 0 || footerOffset < 0 {
		return footer, manifest, errors.New("资源包 footer 长度无效")
	}
	footerRaw := make([]byte, footerSize)
	if _, err := file.ReadAt(footerRaw, footerOffset); err != nil {
		return footer, manifest, err
	}
	if err := json.Unmarshal(footerRaw, &footer); err != nil {
		return footer, manifest, err
	}
	if err := validateFooter(footer, uint64(footerOffset)); err != nil {
		return footer, manifest, err
	}
	manifestRaw := make([]byte, footer.ManifestSize)
	if _, err := file.ReadAt(manifestRaw, int64(footer.ManifestOffset)); err != nil {
		return footer, manifest, err
	}
	if err := json.Unmarshal(manifestRaw, &manifest); err != nil {
		return footer, manifest, err
	}
	if manifest.SchemaVersion != SchemaVersion {
		return footer, manifest, fmt.Errorf("不支持的 manifest 版本: %d", manifest.SchemaVersion)
	}
	return footer, manifest, nil
}

// ensureSlash 保证路径以单个斜杠开头和结尾。
func ensureSlash(value string) string {
	value = "/" + strings.Trim(value, "/") + "/"
	if value == "//" {
		return "/"
	}
	return value
}

// validateFooter 校验 footer 中的偏移和长度是否落在资源包范围内。
func validateFooter(footer Footer, footerOffset uint64) error {
	if footer.SchemaVersion != SchemaVersion {
		return fmt.Errorf("不支持的 footer 版本: %d", footer.SchemaVersion)
	}
	if footer.ZipSize == 0 {
		return errors.New("资源包 zip 为空")
	}
	if footer.ManifestSize == 0 {
		return errors.New("资源包 manifest 为空")
	}
	if footer.ZipOffset+footer.ZipSize != footer.ManifestOffset {
		return errors.New("资源包 zip 偏移不连续")
	}
	if footer.ManifestOffset+footer.ManifestSize != footerOffset {
		return errors.New("资源包 manifest 偏移不连续")
	}
	if strings.TrimSpace(footer.ZipSHA256) == "" {
		return errors.New("资源包缺少 SHA256")
	}
	return nil
}
