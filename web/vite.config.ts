// 文件功能描述：配置管理前端构建入口和 /admin/ 子路径部署基础路径。
import { defineConfig } from "vite";

export default defineConfig({
  base: "/admin/",
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
});

