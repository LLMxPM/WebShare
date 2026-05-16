// 文件功能描述：嵌入 WebShare 品牌图标资源，供托盘入口和桌面外壳复用。
package branding

import _ "embed"

// TrayIconICO 保存从 WebShare 左侧图形区域导出的 Windows ICO 托盘图标。
//
//go:embed webshare-tray.ico
var TrayIconICO []byte

// TrayIcon 返回托盘图标字节副本，避免调用方意外修改嵌入资源。
func TrayIcon() []byte {
	icon := make([]byte, len(TrayIconICO))
	copy(icon, TrayIconICO)
	return icon
}
