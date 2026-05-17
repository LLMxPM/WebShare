// 文件功能描述：定义用户、项目、版本、访问模式和 API 响应使用的核心数据模型。
package model

import "time"

const (
	RoleAdmin = "admin"
	RoleUser  = "user"

	SharePublic   = "public"
	ShareToken    = "share"
	ShareUnshared = "unshared"

	AccessPath  = "path"
	AccessMount = "mount"
	AccessPort  = "port"

	BaseRelative = "relative"
	BaseRoot     = "root"
	BaseFixed    = "fixed"
	BaseMultiple = "multiple"
	BaseUnknown  = "unknown"
)

// User 表示系统登录用户。
type User struct {
	ID           int64     `json:"id"`
	Username     string    `json:"username"`
	Email        string    `json:"email"`
	PasswordHash string    `json:"-"`
	Role         string    `json:"role"`
	Disabled     bool      `json:"disabled"`
	CreatedAt    time.Time `json:"createdAt"`
}

// Project 表示一个静态前端项目及其当前访问配置。
type Project struct {
	ID               int64     `json:"id"`
	OwnerID          int64     `json:"ownerId"`
	Name             string    `json:"name"`
	Slug             string    `json:"slug"`
	Tags             []string  `json:"tags"`
	ShareState       string    `json:"shareState"`
	ShareTokenHash   string    `json:"-"`
	EntryFile        string    `json:"entryFile"`
	SPAEnabled       bool      `json:"spaEnabled"`
	DetectedBaseURL  string    `json:"detectedBaseUrl"`
	MountPath        string    `json:"mountPath"`
	Port             int       `json:"port"`
	AccessMode       string    `json:"accessMode"`
	Active           bool      `json:"active"`
	CurrentVersionID int64     `json:"currentVersionId"`
	CreatedAt        time.Time `json:"createdAt"`
	UpdatedAt        time.Time `json:"updatedAt"`
}

// ProjectVersion 表示项目一次全量发布或文件变更后的快照。
type ProjectVersion struct {
	ID              int64     `json:"id"`
	ProjectID       int64     `json:"projectId"`
	VersionNumber   int       `json:"versionNumber"`
	SourceType      string    `json:"sourceType"`
	StoragePath     string    `json:"-"`
	SizeBytes       int64     `json:"sizeBytes"`
	DetectedBaseURL string    `json:"detectedBaseUrl"`
	Warnings        []string  `json:"warnings"`
	CreatedBy       int64     `json:"createdBy"`
	CreatedAt       time.Time `json:"createdAt"`
}

// ProjectDTO 是前端项目列表和详情页面使用的聚合响应。
type ProjectDTO struct {
	Project
	OwnerUsername string   `json:"ownerUsername,omitempty"`
	AccessURL     string   `json:"accessUrl"`
	ShareURL      string   `json:"shareUrl,omitempty"`
	Warnings      []string `json:"warnings"`
}

// FileEntry 表示项目文件树中的单个文件或目录。
type FileEntry struct {
	Name  string `json:"name"`
	Path  string `json:"path"`
	IsDir bool   `json:"isDir"`
	Size  int64  `json:"size"`
}

// BaseAnalysis 表示发布后对静态产物路径特征的检测结果。
type BaseAnalysis struct {
	DetectedBaseURL  string   `json:"detectedBaseUrl"`
	BaseKind         string   `json:"baseKind"`
	Candidates       []string `json:"candidates"`
	Warnings         []string `json:"warnings"`
	RecommendedMode  string   `json:"recommendedMode"`
	RecommendedMount string   `json:"recommendedMount"`
	FileProbeOK      bool     `json:"fileProbeOk"`
}
