// 文件功能描述：封装 SQLite 数据库迁移和用户、会话、项目、版本的持久化操作。
package store

import (
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"time"

	_ "modernc.org/sqlite"

	"webshare/internal/model"
)

// Store 持有数据库连接，并提供面向业务的持久化方法。
type Store struct {
	db *sql.DB
}

// Open 创建数据目录、打开 SQLite 数据库并执行迁移。
func Open(dataDir string) (*Store, error) {
	if err := os.MkdirAll(dataDir, 0o755); err != nil {
		return nil, err
	}
	dbPath := filepath.Join(dataDir, "webshare.db")
	db, err := sql.Open("sqlite", "file:"+filepath.ToSlash(dbPath)+"?_pragma=foreign_keys(1)&_pragma=busy_timeout(5000)")
	if err != nil {
		return nil, err
	}
	db.SetMaxOpenConns(1)
	s := &Store{db: db}
	if err := s.migrate(); err != nil {
		_ = db.Close()
		return nil, err
	}
	return s, nil
}

// Close 关闭数据库连接。
func (s *Store) Close() error {
	return s.db.Close()
}

// migrate 创建或补齐首版所需的数据表。
func (s *Store) migrate() error {
	statements := []string{
		`CREATE TABLE IF NOT EXISTS users (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			username TEXT NOT NULL UNIQUE,
			email TEXT NOT NULL DEFAULT '',
			password_hash TEXT NOT NULL,
			role TEXT NOT NULL,
			disabled INTEGER NOT NULL DEFAULT 0,
			created_at TEXT NOT NULL
		)`,
		`CREATE TABLE IF NOT EXISTS sessions (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
			token_hash TEXT NOT NULL UNIQUE,
			expires_at TEXT NOT NULL,
			created_at TEXT NOT NULL
		)`,
		`CREATE TABLE IF NOT EXISTS projects (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			owner_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
			name TEXT NOT NULL,
			slug TEXT NOT NULL UNIQUE,
			tags_json TEXT NOT NULL DEFAULT '[]',
			share_state TEXT NOT NULL,
			share_token_hash TEXT NOT NULL DEFAULT '',
			entry_file TEXT NOT NULL DEFAULT 'index.html',
			spa_enabled INTEGER NOT NULL DEFAULT 1,
			detected_base_url TEXT NOT NULL DEFAULT '',
			mount_path TEXT NOT NULL DEFAULT '',
			port INTEGER NOT NULL DEFAULT 0,
			access_mode TEXT NOT NULL DEFAULT 'path',
			active INTEGER NOT NULL DEFAULT 1,
			current_version_id INTEGER NOT NULL DEFAULT 0,
			created_at TEXT NOT NULL,
			updated_at TEXT NOT NULL
		)`,
		`CREATE TABLE IF NOT EXISTS project_versions (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
			version_number INTEGER NOT NULL,
			source_type TEXT NOT NULL,
			storage_path TEXT NOT NULL,
			size_bytes INTEGER NOT NULL,
			detected_base_url TEXT NOT NULL DEFAULT '',
			warnings_json TEXT NOT NULL DEFAULT '[]',
			pinned INTEGER NOT NULL DEFAULT 0,
			created_by INTEGER NOT NULL REFERENCES users(id),
			created_at TEXT NOT NULL,
			UNIQUE(project_id, version_number)
		)`,
		`CREATE TABLE IF NOT EXISTS settings (
			key TEXT PRIMARY KEY,
			value TEXT NOT NULL,
			updated_at TEXT NOT NULL
		)`,
	}
	for _, stmt := range statements {
		if _, err := s.db.Exec(stmt); err != nil {
			return err
		}
	}
	if err := s.addColumnIfMissing("users", "email", "TEXT NOT NULL DEFAULT ''"); err != nil {
		return err
	}
	if err := s.addColumnIfMissing("projects", "active", "INTEGER NOT NULL DEFAULT 1"); err != nil {
		return err
	}
	if err := s.addColumnIfMissing("projects", "tags_json", "TEXT NOT NULL DEFAULT '[]'"); err != nil {
		return err
	}
	if err := s.addColumnIfMissing("project_versions", "pinned", "INTEGER NOT NULL DEFAULT 0"); err != nil {
		return err
	}
	if _, err := s.db.Exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email ON users(email) WHERE email <> ''`); err != nil {
		return err
	}
	if _, err := s.db.Exec(`DROP INDEX IF EXISTS idx_projects_mount_path`); err != nil {
		return err
	}
	if _, err := s.db.Exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_projects_active_mount_path ON projects(mount_path) WHERE mount_path <> '' AND active = 1 AND access_mode = 'mount'`); err != nil {
		return err
	}
	if _, err := s.db.Exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_projects_port ON projects(port) WHERE port > 0`); err != nil {
		return err
	}
	return nil
}

// addColumnIfMissing 为旧数据库补齐新增字段。
func (s *Store) addColumnIfMissing(table, column, definition string) error {
	rows, err := s.db.Query(`PRAGMA table_info(` + table + `)`)
	if err != nil {
		return err
	}
	defer rows.Close()
	for rows.Next() {
		var cid int
		var name, dataType string
		var notNull int
		var defaultValue any
		var primaryKey int
		if err := rows.Scan(&cid, &name, &dataType, &notNull, &defaultValue, &primaryKey); err != nil {
			return err
		}
		if name == column {
			return rows.Err()
		}
	}
	if err := rows.Err(); err != nil {
		return err
	}
	_, err = s.db.Exec(`ALTER TABLE ` + table + ` ADD COLUMN ` + column + ` ` + definition)
	return err
}

// GetSetting 读取系统配置项，不存在时返回空字符串。
func (s *Store) GetSetting(key string) (string, error) {
	var value string
	err := s.db.QueryRow(`SELECT value FROM settings WHERE key = ?`, key).Scan(&value)
	if errors.Is(err, sql.ErrNoRows) {
		return "", nil
	}
	return value, err
}

// SetSetting 保存系统配置项。
func (s *Store) SetSetting(key, value string) error {
	_, err := s.db.Exec(`INSERT INTO settings(key, value, updated_at) VALUES(?, ?, ?)
		ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
		key, value, formatTime(time.Now().UTC()))
	return err
}

// UserCount 返回用户数量，用于判断是否需要初始化管理员。
func (s *Store) UserCount() (int, error) {
	var count int
	err := s.db.QueryRow(`SELECT COUNT(*) FROM users`).Scan(&count)
	return count, err
}

// CreateUser 创建用户，调用方负责提前完成权限、用户名和邮箱校验。
func (s *Store) CreateUser(username, email, passwordHash, role string) (model.User, error) {
	now := time.Now().UTC()
	res, err := s.db.Exec(`INSERT INTO users(username, email, password_hash, role, disabled, created_at) VALUES(?, ?, ?, ?, 0, ?)`,
		username, email, passwordHash, role, formatTime(now))
	if err != nil {
		return model.User{}, err
	}
	id, _ := res.LastInsertId()
	return s.UserByID(id)
}

// ListUsers 返回所有用户，按创建时间升序排列。
func (s *Store) ListUsers() ([]model.User, error) {
	rows, err := s.db.Query(`SELECT id, username, email, password_hash, role, disabled, created_at FROM users ORDER BY id ASC`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	users := make([]model.User, 0)
	for rows.Next() {
		user, err := scanUser(rows)
		if err != nil {
			return nil, err
		}
		users = append(users, user)
	}
	return users, rows.Err()
}

// UserByID 根据用户 ID 查询用户。
func (s *Store) UserByID(id int64) (model.User, error) {
	row := s.db.QueryRow(`SELECT id, username, email, password_hash, role, disabled, created_at FROM users WHERE id = ?`, id)
	return scanUser(row)
}

// UserByUsername 根据用户名查询用户。
func (s *Store) UserByUsername(username string) (model.User, error) {
	row := s.db.QueryRow(`SELECT id, username, email, password_hash, role, disabled, created_at FROM users WHERE username = ?`, username)
	return scanUser(row)
}

// UserByLogin 根据用户名或邮箱查询可登录用户。
func (s *Store) UserByLogin(login string) (model.User, error) {
	row := s.db.QueryRow(`SELECT id, username, email, password_hash, role, disabled, created_at
		FROM users WHERE username = ? OR email = ? LIMIT 1`, login, strings.ToLower(login))
	return scanUser(row)
}

// UpdateUser 更新用户基础资料、角色和禁用状态。
func (s *Store) UpdateUser(id int64, username, email, role string, disabled bool) (model.User, error) {
	_, err := s.db.Exec(`UPDATE users SET username = ?, email = ?, role = ?, disabled = ? WHERE id = ?`,
		username, email, role, boolInt(disabled), id)
	if err != nil {
		return model.User{}, err
	}
	return s.UserByID(id)
}

// ResetPassword 更新用户密码摘要。
func (s *Store) ResetPassword(id int64, passwordHash string) error {
	res, err := s.db.Exec(`UPDATE users SET password_hash = ? WHERE id = ?`, passwordHash, id)
	if err != nil {
		return err
	}
	affected, err := res.RowsAffected()
	if err != nil {
		return err
	}
	if affected == 0 {
		return ErrNotFound
	}
	return nil
}

// CreateSession 保存登录会话摘要和过期时间。
func (s *Store) CreateSession(userID int64, tokenHash string, expiresAt time.Time) error {
	_, err := s.db.Exec(`INSERT INTO sessions(user_id, token_hash, expires_at, created_at) VALUES(?, ?, ?, ?)`,
		userID, tokenHash, formatTime(expiresAt), formatTime(time.Now().UTC()))
	return err
}

// DeleteSession 删除指定令牌摘要对应的会话。
func (s *Store) DeleteSession(tokenHash string) error {
	_, err := s.db.Exec(`DELETE FROM sessions WHERE token_hash = ?`, tokenHash)
	return err
}

// DeleteSessionsForUser 删除指定用户的全部会话，通常用于重置密码后强制重新登录。
func (s *Store) DeleteSessionsForUser(userID int64) error {
	_, err := s.db.Exec(`DELETE FROM sessions WHERE user_id = ?`, userID)
	return err
}

// DeleteOtherSessionsForUser 删除指定用户除当前令牌外的其他会话。
func (s *Store) DeleteOtherSessionsForUser(userID int64, keepTokenHash string) error {
	_, err := s.db.Exec(`DELETE FROM sessions WHERE user_id = ? AND token_hash <> ?`, userID, keepTokenHash)
	return err
}

// UserBySession 根据会话令牌摘要查询未过期用户。
func (s *Store) UserBySession(tokenHash string) (model.User, error) {
	row := s.db.QueryRow(`SELECT u.id, u.username, u.email, u.password_hash, u.role, u.disabled, u.created_at
		FROM sessions s JOIN users u ON u.id = s.user_id
		WHERE s.token_hash = ? AND s.expires_at > ? AND u.disabled = 0`, tokenHash, formatTime(time.Now().UTC()))
	return scanUser(row)
}

// CreateProject 创建项目基础记录，并保存已清洗的项目标签。
func (s *Store) CreateProject(ownerID int64, name, slug string, tags []string) (model.Project, error) {
	now := time.Now().UTC()
	res, err := s.db.Exec(`INSERT INTO projects(owner_id, name, slug, tags_json, share_state, entry_file, spa_enabled, access_mode, active, created_at, updated_at)
		VALUES(?, ?, ?, ?, ?, 'index.html', 1, ?, 1, ?, ?)`,
		ownerID, name, slug, projectTagsJSON(tags), model.SharePublic, model.AccessPath, formatTime(now), formatTime(now))
	if err != nil {
		return model.Project{}, err
	}
	id, _ := res.LastInsertId()
	return s.ProjectByID(id)
}

// ProjectByID 根据项目 ID 查询项目。
func (s *Store) ProjectByID(id int64) (model.Project, error) {
	row := s.db.QueryRow(projectSelectSQL()+` WHERE p.id = ?`, id)
	return scanProject(row)
}

// ProjectBySlug 根据 slug 查询项目。
func (s *Store) ProjectBySlug(slug string) (model.Project, error) {
	row := s.db.QueryRow(projectSelectSQL()+` WHERE p.slug = ?`, slug)
	return scanProject(row)
}

// ProjectByMountPath 查询精确匹配的自定义挂载路径。
func (s *Store) ProjectByMountPath(mountPath string) (model.Project, error) {
	row := s.db.QueryRow(projectSelectSQL()+` WHERE p.mount_path = ?`, mountPath)
	return scanProject(row)
}

// ProjectByPort 根据独立端口查询项目。
func (s *Store) ProjectByPort(port int) (model.Project, error) {
	row := s.db.QueryRow(projectSelectSQL()+` WHERE p.port = ?`, port)
	return scanProject(row)
}

// ListProjects 根据当前用户角色返回可见项目。
func (s *Store) ListProjects(user model.User) ([]model.Project, error) {
	query := projectSelectSQL()
	args := []any{}
	if user.Role != model.RoleAdmin {
		query += ` WHERE p.owner_id = ?`
		args = append(args, user.ID)
	}
	query += ` ORDER BY p.updated_at DESC, p.id DESC`
	rows, err := s.db.Query(query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	projects := make([]model.Project, 0)
	for rows.Next() {
		project, err := scanProject(rows)
		if err != nil {
			return nil, err
		}
		projects = append(projects, project)
	}
	return projects, rows.Err()
}

// ListAllProjects 返回所有项目，端口服务启动时使用。
func (s *Store) ListAllProjects() ([]model.Project, error) {
	rows, err := s.db.Query(projectSelectSQL() + ` ORDER BY p.id ASC`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	projects := make([]model.Project, 0)
	for rows.Next() {
		project, err := scanProject(rows)
		if err != nil {
			return nil, err
		}
		projects = append(projects, project)
	}
	return projects, rows.Err()
}

// UpdateProjectSettings 更新项目可变配置。
func (s *Store) UpdateProjectSettings(project model.Project) (model.Project, error) {
	project.UpdatedAt = time.Now().UTC()
	_, err := s.db.Exec(`UPDATE projects SET name = ?, slug = ?, tags_json = ?, share_state = ?, share_token_hash = ?, entry_file = ?,
		spa_enabled = ?, detected_base_url = ?, mount_path = ?, port = ?, access_mode = ?, active = ?, current_version_id = ?, updated_at = ?
		WHERE id = ?`,
		project.Name, project.Slug, projectTagsJSON(project.Tags), project.ShareState, project.ShareTokenHash, project.EntryFile, boolInt(project.SPAEnabled),
		project.DetectedBaseURL, project.MountPath, project.Port, project.AccessMode, boolInt(project.Active), project.CurrentVersionID,
		formatTime(project.UpdatedAt), project.ID)
	if err != nil {
		return model.Project{}, err
	}
	return s.ProjectByID(project.ID)
}

// DeleteProject 删除项目和相关版本元数据。
func (s *Store) DeleteProject(id int64) error {
	_, err := s.db.Exec(`DELETE FROM projects WHERE id = ?`, id)
	return err
}

// SlugExists 判断 slug 是否被其他项目占用。
func (s *Store) SlugExists(slug string, excludeID int64) (bool, error) {
	var id int64
	err := s.db.QueryRow(`SELECT id FROM projects WHERE slug = ? AND id <> ? LIMIT 1`, slug, excludeID).Scan(&id)
	if errors.Is(err, sql.ErrNoRows) {
		return false, nil
	}
	return err == nil, err
}

// MountPathConflict 检查激活挂载项目之间是否存在相同或父子路径关系。
func (s *Store) MountPathConflict(mountPath string, excludeID int64) (bool, string, error) {
	rows, err := s.db.Query(`SELECT id, mount_path FROM projects WHERE mount_path <> '' AND active = 1 AND access_mode = ? AND id <> ?`,
		model.AccessMount, excludeID)
	if err != nil {
		return false, "", err
	}
	defer rows.Close()
	for rows.Next() {
		var id int64
		var existing string
		if err := rows.Scan(&id, &existing); err != nil {
			return false, "", err
		}
		if existing == mountPath || isPathParent(existing, mountPath) || isPathParent(mountPath, existing) {
			return true, existing, nil
		}
	}
	return false, "", rows.Err()
}

// PortInUse 判断端口是否已被项目记录占用。
func (s *Store) PortInUse(port int, excludeID int64) (bool, error) {
	var id int64
	err := s.db.QueryRow(`SELECT id FROM projects WHERE port = ? AND id <> ? LIMIT 1`, port, excludeID).Scan(&id)
	if errors.Is(err, sql.ErrNoRows) {
		return false, nil
	}
	return err == nil, err
}

// InsertVersion 保存一次项目版本记录。
func (s *Store) InsertVersion(projectID int64, sourceType, storagePath string, sizeBytes int64, detectedBaseURL string, warnings []string, createdBy int64) (model.ProjectVersion, error) {
	next, err := s.NextVersionNumber(projectID)
	if err != nil {
		return model.ProjectVersion{}, err
	}
	warningsJSON, _ := json.Marshal(warnings)
	now := time.Now().UTC()
	res, err := s.db.Exec(`INSERT INTO project_versions(project_id, version_number, source_type, storage_path, size_bytes, detected_base_url, warnings_json, created_by, created_at)
		VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		projectID, next, sourceType, storagePath, sizeBytes, detectedBaseURL, string(warningsJSON), createdBy, formatTime(now))
	if err != nil {
		return model.ProjectVersion{}, err
	}
	id, _ := res.LastInsertId()
	return s.VersionByID(id)
}

// UpdateVersionMetadata 更新版本文件目录、大小和分析结果。
func (s *Store) UpdateVersionMetadata(versionID int64, storagePath string, sizeBytes int64, detectedBaseURL string, warnings []string) (model.ProjectVersion, error) {
	warningsJSON, _ := json.Marshal(warnings)
	_, err := s.db.Exec(`UPDATE project_versions SET storage_path = ?, size_bytes = ?, detected_base_url = ?, warnings_json = ? WHERE id = ?`,
		storagePath, sizeBytes, detectedBaseURL, string(warningsJSON), versionID)
	if err != nil {
		return model.ProjectVersion{}, err
	}
	return s.VersionByID(versionID)
}

// NextVersionNumber 返回项目下一个版本号。
func (s *Store) NextVersionNumber(projectID int64) (int, error) {
	var max sql.NullInt64
	err := s.db.QueryRow(`SELECT MAX(version_number) FROM project_versions WHERE project_id = ?`, projectID).Scan(&max)
	if err != nil {
		return 0, err
	}
	if !max.Valid {
		return 1, nil
	}
	return int(max.Int64) + 1, nil
}

// VersionByID 根据版本 ID 查询版本。
func (s *Store) VersionByID(id int64) (model.ProjectVersion, error) {
	row := s.db.QueryRow(`SELECT id, project_id, version_number, source_type, storage_path, size_bytes, detected_base_url, warnings_json, pinned, created_by, created_at
		FROM project_versions WHERE id = ?`, id)
	return scanVersion(row)
}

// CurrentVersion 查询项目当前激活版本。
func (s *Store) CurrentVersion(project model.Project) (model.ProjectVersion, error) {
	if project.CurrentVersionID == 0 {
		return model.ProjectVersion{}, sql.ErrNoRows
	}
	return s.VersionByID(project.CurrentVersionID)
}

// ListVersions 返回项目全部历史版本。
func (s *Store) ListVersions(projectID int64) ([]model.ProjectVersion, error) {
	rows, err := s.db.Query(`SELECT id, project_id, version_number, source_type, storage_path, size_bytes, detected_base_url, warnings_json, pinned, created_by, created_at
		FROM project_versions WHERE project_id = ? ORDER BY version_number DESC`, projectID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	versions := make([]model.ProjectVersion, 0)
	for rows.Next() {
		version, err := scanVersion(rows)
		if err != nil {
			return nil, err
		}
		versions = append(versions, version)
	}
	return versions, rows.Err()
}

// LatestVersionExcept 返回排除指定版本后的最新版本。
func (s *Store) LatestVersionExcept(projectID, excludeVersionID int64) (model.ProjectVersion, error) {
	row := s.db.QueryRow(`SELECT id, project_id, version_number, source_type, storage_path, size_bytes, detected_base_url, warnings_json, pinned, created_by, created_at
		FROM project_versions WHERE project_id = ? AND id <> ? ORDER BY version_number DESC LIMIT 1`, projectID, excludeVersionID)
	return scanVersion(row)
}

// AutoPruneVersions 返回应自动清理的未固定历史版本，固定版本和当前版本不计入保留数量。
func (s *Store) AutoPruneVersions(projectID, currentVersionID int64, keepHistory int) ([]model.ProjectVersion, error) {
	rows, err := s.db.Query(`SELECT id, project_id, version_number, source_type, storage_path, size_bytes, detected_base_url, warnings_json, pinned, created_by, created_at
		FROM project_versions
		WHERE project_id = ? AND pinned = 0 AND id <> ?
		ORDER BY created_at DESC, id DESC`, projectID, currentVersionID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	versions := make([]model.ProjectVersion, 0)
	for rows.Next() {
		version, err := scanVersion(rows)
		if err != nil {
			return nil, err
		}
		versions = append(versions, version)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	if keepHistory < 0 {
		keepHistory = 0
	}
	if len(versions) <= keepHistory {
		return []model.ProjectVersion{}, nil
	}
	return versions[keepHistory:], nil
}

// UpdateVersionPinned 更新版本固定状态，固定版本不会被自动清理。
func (s *Store) UpdateVersionPinned(id int64, pinned bool) (model.ProjectVersion, error) {
	res, err := s.db.Exec(`UPDATE project_versions SET pinned = ? WHERE id = ?`, boolInt(pinned), id)
	if err != nil {
		return model.ProjectVersion{}, err
	}
	affected, err := res.RowsAffected()
	if err != nil {
		return model.ProjectVersion{}, err
	}
	if affected == 0 {
		return model.ProjectVersion{}, ErrNotFound
	}
	return s.VersionByID(id)
}

// ActivateVersion 将指定版本设为项目当前版本。
func (s *Store) ActivateVersion(project model.Project, version model.ProjectVersion) (model.Project, error) {
	project.CurrentVersionID = version.ID
	project.DetectedBaseURL = version.DetectedBaseURL
	return s.UpdateProjectSettings(project)
}

// DeleteVersion 删除指定版本元数据。
func (s *Store) DeleteVersion(id int64) error {
	res, err := s.db.Exec(`DELETE FROM project_versions WHERE id = ?`, id)
	if err != nil {
		return err
	}
	affected, err := res.RowsAffected()
	if err != nil {
		return err
	}
	if affected == 0 {
		return ErrNotFound
	}
	return nil
}

// projectSelectSQL 返回项目查询的基础 SELECT 语句。
func projectSelectSQL() string {
	return `SELECT p.id, p.owner_id, p.name, p.slug, p.tags_json, p.share_state, p.share_token_hash, p.entry_file,
		p.spa_enabled, p.detected_base_url, p.mount_path, p.port, p.access_mode, p.active, p.current_version_id,
		p.created_at, p.updated_at FROM projects p`
}

type rowScanner interface {
	Scan(dest ...any) error
}

// scanUser 从数据库行读取用户模型。
func scanUser(row rowScanner) (model.User, error) {
	var user model.User
	var disabled int
	var created string
	if err := row.Scan(&user.ID, &user.Username, &user.Email, &user.PasswordHash, &user.Role, &disabled, &created); err != nil {
		return model.User{}, err
	}
	user.Disabled = disabled != 0
	user.CreatedAt = parseTime(created)
	return user, nil
}

// scanProject 从数据库行读取项目模型。
func scanProject(row rowScanner) (model.Project, error) {
	var project model.Project
	var tagsJSON string
	var spa, active int
	var created, updated string
	if err := row.Scan(&project.ID, &project.OwnerID, &project.Name, &project.Slug, &tagsJSON, &project.ShareState,
		&project.ShareTokenHash, &project.EntryFile, &spa, &project.DetectedBaseURL, &project.MountPath,
		&project.Port, &project.AccessMode, &active, &project.CurrentVersionID, &created, &updated); err != nil {
		return model.Project{}, err
	}
	if err := json.Unmarshal([]byte(tagsJSON), &project.Tags); err != nil {
		return model.Project{}, err
	}
	if project.Tags == nil {
		project.Tags = []string{}
	}
	project.SPAEnabled = spa != 0
	project.Active = active != 0
	project.CreatedAt = parseTime(created)
	project.UpdatedAt = parseTime(updated)
	return project, nil
}

// projectTagsJSON 将项目标签序列化为数据库字段，空值保持为空数组。
func projectTagsJSON(tags []string) string {
	if tags == nil {
		tags = []string{}
	}
	data, _ := json.Marshal(tags)
	return string(data)
}

// scanVersion 从数据库行读取项目版本模型。
func scanVersion(row rowScanner) (model.ProjectVersion, error) {
	var version model.ProjectVersion
	var warningsJSON string
	var pinned int
	var created string
	if err := row.Scan(&version.ID, &version.ProjectID, &version.VersionNumber, &version.SourceType,
		&version.StoragePath, &version.SizeBytes, &version.DetectedBaseURL, &warningsJSON,
		&pinned, &version.CreatedBy, &created); err != nil {
		return model.ProjectVersion{}, err
	}
	_ = json.Unmarshal([]byte(warningsJSON), &version.Warnings)
	if version.Warnings == nil {
		version.Warnings = []string{}
	}
	version.Pinned = pinned != 0
	version.CreatedAt = parseTime(created)
	return version, nil
}

// formatTime 以 RFC3339Nano 格式存储 UTC 时间。
func formatTime(t time.Time) string {
	return t.UTC().Format(time.RFC3339Nano)
}

// parseTime 解析数据库中的 UTC 时间字符串。
func parseTime(value string) time.Time {
	t, err := time.Parse(time.RFC3339Nano, value)
	if err != nil {
		return time.Time{}
	}
	return t
}

// boolInt 将布尔值转换为 SQLite 使用的 0/1。
func boolInt(v bool) int {
	if v {
		return 1
	}
	return 0
}

// isPathParent 判断 parent 是否是 child 的路径父级。
func isPathParent(parent, child string) bool {
	if parent == child {
		return true
	}
	if len(parent) > len(child) {
		return false
	}
	return len(parent) > 1 && child[:len(parent)] == parent
}

// ErrNotFound 表示查询对象不存在。
var ErrNotFound = sql.ErrNoRows

// WrapConflict 将底层唯一约束错误转换为带上下文的错误。
func WrapConflict(entity string, err error) error {
	if err == nil {
		return nil
	}
	return fmt.Errorf("%s 保存失败: %w", entity, err)
}
