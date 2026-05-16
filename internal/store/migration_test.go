// 文件功能描述：验证数据库迁移对旧项目表的兼容补列行为。
package store

import (
	"database/sql"
	"path/filepath"
	"testing"
	"time"
)

// TestMigrateAddsProjectActiveDefault 验证旧库项目迁移后默认保持激活。
func TestMigrateAddsProjectActiveDefault(t *testing.T) {
	dataDir := t.TempDir()
	dbPath := filepath.Join(dataDir, "static-host.db")
	db, err := sql.Open("sqlite", "file:"+filepath.ToSlash(dbPath))
	if err != nil {
		t.Fatal(err)
	}
	now := time.Now().UTC().Format(time.RFC3339Nano)
	_, err = db.Exec(`CREATE TABLE projects (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		owner_id INTEGER NOT NULL,
		name TEXT NOT NULL,
		slug TEXT NOT NULL UNIQUE,
		share_state TEXT NOT NULL,
		share_token_hash TEXT NOT NULL DEFAULT '',
		entry_file TEXT NOT NULL DEFAULT 'index.html',
		spa_enabled INTEGER NOT NULL DEFAULT 1,
		detected_base_url TEXT NOT NULL DEFAULT '',
		mount_path TEXT NOT NULL DEFAULT '',
		port INTEGER NOT NULL DEFAULT 0,
		access_mode TEXT NOT NULL DEFAULT 'path',
		current_version_id INTEGER NOT NULL DEFAULT 0,
		created_at TEXT NOT NULL,
		updated_at TEXT NOT NULL
	)`)
	if err != nil {
		t.Fatal(err)
	}
	_, err = db.Exec(`INSERT INTO projects(owner_id, name, slug, share_state, created_at, updated_at) VALUES(1, '旧项目', 'old-project', 'public', ?, ?)`, now, now)
	if err != nil {
		t.Fatal(err)
	}
	if err := db.Close(); err != nil {
		t.Fatal(err)
	}

	store, err := Open(dataDir)
	if err != nil {
		t.Fatal(err)
	}
	defer store.Close()
	project, err := store.ProjectByID(1)
	if err != nil {
		t.Fatal(err)
	}
	if !project.Active {
		t.Fatal("expected migrated project to remain active")
	}
}
