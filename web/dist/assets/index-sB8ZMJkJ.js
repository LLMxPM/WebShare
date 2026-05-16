(function(){const a=document.createElement("link").relList;if(a&&a.supports&&a.supports("modulepreload"))return;for(const i of document.querySelectorAll('link[rel="modulepreload"]'))n(i);new MutationObserver(i=>{for(const l of i)if(l.type==="childList")for(const b of l.addedNodes)b.tagName==="LINK"&&b.rel==="modulepreload"&&n(b)}).observe(document,{childList:!0,subtree:!0});function s(i){const l={};return i.integrity&&(l.integrity=i.integrity),i.referrerPolicy&&(l.referrerPolicy=i.referrerPolicy),i.crossOrigin==="use-credentials"?l.credentials="include":i.crossOrigin==="anonymous"?l.credentials="omit":l.credentials="same-origin",l}function n(i){if(i.ep)return;i.ep=!0;const l=s(i);fetch(i.href,l)}})();async function c(e,a={}){const s=new Headers(a.headers);a.body&&!(a.body instanceof FormData)&&!s.has("Content-Type")&&s.set("Content-Type","application/json");const n=await fetch(e,{...a,headers:s,credentials:"same-origin"}),i=await n.text(),l=i?JSON.parse(i):{};if(!n.ok){const b=new Error(l.error||"请求失败");throw b.status=n.status,b}return l}function j(e,a){const s=new FormData;return s.set("file",a),c(e,{method:"POST",body:s})}const r={me:()=>c("/api/me"),login:(e,a)=>c("/api/auth/login",{method:"POST",body:JSON.stringify({username:e,password:a})}),logout:()=>c("/api/auth/logout",{method:"POST"}),users:()=>c("/api/users"),createUser:e=>c("/api/users",{method:"POST",body:JSON.stringify(e)}),updateUser:(e,a)=>c(`/api/users/${e}`,{method:"PATCH",body:JSON.stringify(a)}),resetPassword:(e,a)=>c(`/api/users/${e}/reset-password`,{method:"POST",body:JSON.stringify({password:a})}),projects:()=>c("/api/projects"),createProject:e=>c("/api/projects",{method:"POST",body:JSON.stringify(e)}),updateProject:(e,a)=>c(`/api/projects/${e}`,{method:"PATCH",body:JSON.stringify(a)}),activateProject:e=>c(`/api/projects/${e}/activate`,{method:"POST"}),deactivateProject:e=>c(`/api/projects/${e}/deactivate`,{method:"POST"}),deleteProject:e=>c(`/api/projects/${e}`,{method:"DELETE"}),publishZip:(e,a)=>j(`/api/projects/${e}/publish/zip`,a),publishHtml:(e,a)=>j(`/api/projects/${e}/publish/html`,a),packageExeUrl:e=>`/api/projects/${e}/packages/exe`,versions:e=>c(`/api/projects/${e}/versions`),activateVersion:(e,a)=>c(`/api/projects/${e}/versions/${a}/activate`,{method:"POST"}),files:(e,a)=>c(`/api/projects/${e}/files?path=${encodeURIComponent(a)}`),putFile:(e,a,s)=>fetch(`/api/projects/${e}/files?path=${encodeURIComponent(a)}`,{method:"PUT",body:s,credentials:"same-origin"}).then(async n=>{const i=await n.json();if(!n.ok)throw new Error(i.error||"上传失败");return i}),deleteFile:(e,a)=>c(`/api/projects/${e}/files?path=${encodeURIComponent(a)}`,{method:"DELETE"}),shareToken:e=>c(`/api/projects/${e}/share-token`,{method:"POST"}),publicHost:()=>c("/api/system/public-host"),updatePublicHost:e=>c("/api/system/public-host",{method:"PATCH",body:JSON.stringify({publicHost:e})})},t={me:null,users:[],projects:[],selectedId:null,versions:[],files:[],publicHostInfo:null,filePath:"",activeView:"projects",activeProjectTab:"overview",projectSearch:"",projectShareFilter:"all",createModalOpen:!1,userSearch:"",userModal:null,message:"",error:"",shareUrl:""},h=document.querySelector("#app");async function U(){try{const{user:e}=await r.me();t.me=e,await u()}catch{t.me=null}p()}async function u(){if(!t.me)return;const e=t.me.role==="admin";(t.activeView==="users"||t.activeView==="share")&&!e&&(t.activeView="projects");const[{projects:a}]=await Promise.all([r.projects(),e?F():Promise.resolve()]);t.projects=a??[],(!t.selectedId||!t.projects.some(s=>s.id===t.selectedId))&&(t.selectedId=t.projects[0]?.id??null),await S()}async function v(){const{users:e}=await r.users();t.users=e??[]}async function F(){await Promise.all([v(),E()])}async function E(){t.publicHostInfo=await r.publicHost()}async function S(){const e=f();if(!e||!e.currentVersionId){t.versions=[],t.files=[];return}const[{versions:a},{files:s}]=await Promise.all([r.versions(e.id),r.files(e.id,t.filePath)]);t.versions=a??[],t.files=s??[]}function f(){return t.projects.find(e=>e.id===t.selectedId)||null}function V(){const e=t.projectSearch.trim().toLowerCase();return t.projects.filter(a=>{const s=!e||a.name.toLowerCase().includes(e)||a.slug.toLowerCase().includes(e),n=t.projectShareFilter==="all"||a.shareState===t.projectShareFilter;return s&&n})}function O(){const e=t.userSearch.trim().toLowerCase();return e?t.users.filter(a=>a.username.toLowerCase().includes(e)||(a.email||"").toLowerCase().includes(e)||k(a.role).toLowerCase().includes(e)):t.users}function p(){h.innerHTML=t.me?C():x(),oe()}function x(){return`
    <main class="login-shell">
      <form class="login-panel" data-form="login">
        <div class="login-brand">
          <span class="logo">SH</span>
          <div>
            <h1>静态项目托管</h1>
            <p>内部管理控制台</p>
          </div>
        </div>
        ${y()}
        <label>用户名 / 邮箱<input name="username" autocomplete="username" required /></label>
        <label>密码<input name="password" type="password" autocomplete="current-password" required /></label>
        <button class="primary block" type="submit">登录</button>
      </form>
    </main>
  `}function C(){const e=t.activeView==="projects";return`
    <main class="console-shell ${e?"":"single-workspace"}">
      ${N()}
      ${e?D():""}
      <section class="workspace">
        ${q()}
      </section>
      ${t.createModalOpen&&e?A():""}
      ${t.userModal&&t.activeView==="users"?ae():""}
    </main>
  `}function q(){return t.activeView==="users"?Y():t.activeView==="share"?se():B()}function N(){const e=t.me;return`
    <aside class="global-nav">
      <div class="brand">
        <span class="logo">SH</span>
        <div>
          <strong>Static Host</strong>
          <span>静态项目托管</span>
        </div>
      </div>
      <nav class="nav-stack">
        <button class="nav-item ${t.activeView==="projects"?"active":""}" data-action="set-view" data-view="projects">
          <span>项目</span><b>${t.projects.length}</b>
        </button>
        ${e.role==="admin"?`<button class="nav-item ${t.activeView==="share"?"active":""}" data-action="set-view" data-view="share">
                <span>分享地址</span><b>IP</b>
              </button>
              <button class="nav-item ${t.activeView==="users"?"active":""}" data-action="set-view" data-view="users">
                <span>用户</span><b>${t.users.length}</b>
              </button>`:""}
      </nav>
      <div class="account-box">
        <div>
          <strong>${o(e.username)}</strong>
          <span>${k(e.role)}</span>
        </div>
        <button data-action="logout">退出</button>
      </div>
    </aside>
  `}function D(){const e=V();return`
    <aside class="project-column">
      <div class="column-head">
        <div>
          <h2>项目</h2>
          <span class="muted project-count">${e.length} / ${t.projects.length}</span>
        </div>
        <button class="primary" data-action="open-create-modal">新建</button>
      </div>
      <div class="project-filters">
        <input data-input="project-search" value="${d(t.projectSearch)}" placeholder="搜索项目名称或标识" />
        <select data-change="share-filter">
          ${m("all","全部状态",t.projectShareFilter)}
          ${m("public","公开",t.projectShareFilter)}
          ${m("share","令牌分享",t.projectShareFilter)}
          ${m("unshared","不分享",t.projectShareFilter)}
        </select>
      </div>
      <div class="project-list">${e.map(z).join("")||'<p class="empty">没有匹配项目</p>'}</div>
    </aside>
  `}function A(){return`
    <div class="modal-backdrop" role="presentation">
      <section class="modal-panel" role="dialog" aria-modal="true" aria-label="创建项目">
        <div class="modal-head">
          <div>
            <span class="eyebrow">新建项目</span>
            <h2>创建并发布</h2>
          </div>
          <button class="ghost" type="button" data-action="close-create-modal">关闭</button>
        </div>
        <form class="modal-form" data-form="project">
          <label>项目名称<input name="name" placeholder="例如：后台管理系统" required autofocus /></label>
          <label>发布文件（可选）<input name="file" type="file" accept=".zip,.html,.htm,application/zip,text/html" /></label>
          <div class="hint">项目标识会按日期和随机码自动生成；选择 ZIP 会按构建产物发布，选择 HTML 会作为 index.html 发布。</div>
          <div class="modal-actions">
            <button type="button" data-action="close-create-modal">取消</button>
            <button class="primary" type="submit">创建项目</button>
          </div>
        </form>
      </section>
    </div>
  `}function z(e){return`
    <button class="project-item ${e.id===t.selectedId?"active":""}" data-action="select-project" data-id="${e.id}">
      <span class="project-name">${o(e.name)}</span>
      <span class="project-meta">
        <b>${o(e.slug)}</b>
        <em>${$(e.accessMode)}</em>
      </span>
      <span class="mini-pills">
        <i class="${e.active?"enabled":"disabled"}">${T(e.active)}</i>
        <i class="${e.shareState}">${w(e.shareState)}</i>
        <i>${e.currentVersionId?"已发布":"未发布"}</i>
      </span>
    </button>
  `}function B(){const e=f();return e?`
    <div class="workspace-stack">
      ${y()}
      ${R(e)}
      ${Z(e)}
      ${J(e)}
    </div>
  `:ie()}function R(e){return`
    <section class="hero-panel">
      <div class="hero-main">
        <div class="status-row">
          <span class="pill ${e.active?"enabled":"disabled"}">${T(e.active)}</span>
          <span class="pill">${$(e.accessMode)}</span>
          <span class="pill ${e.shareState}">${w(e.shareState)}</span>
          <span class="pill">${e.spaEnabled?"SPA fallback":"普通静态"}</span>
        </div>
        <h1>${o(e.name)}</h1>
        <div class="slug-line">${o(e.slug)}</div>
      </div>
      <div class="hero-actions">
        <button class="primary" data-action="copy-link" data-url="${d(e.accessUrl)}" ${e.active?"":"disabled"}>复制地址</button>
        ${e.active?`<a class="button-link" href="${d(e.accessUrl)}" target="_blank" rel="noreferrer">打开项目</a>`:"<button disabled>打开项目</button>"}
        ${e.currentVersionId?`<a class="button-link" href="${d(r.packageExeUrl(e.id))}">下载 EXE</a>`:"<button disabled>下载 EXE</button>"}
        <button data-action="set-tab" data-tab="publish">发布</button>
        <button data-action="share-token">分享链接</button>
        ${e.active?'<button class="danger" data-action="deactivate-project">停用</button>':'<button class="primary" data-action="activate-project">激活</button>'}
      </div>
      <div class="access-strip">
        <span>访问地址</span>
        ${e.active?`<a href="${d(e.accessUrl)}" target="_blank" rel="noreferrer">${o(e.accessUrl)}</a>`:`<code>${o(e.accessUrl)}</code>`}
      </div>
      ${t.shareUrl?`<div class="access-strip token"><span>分享链接</span><code>${o(t.shareUrl)}</code></div>`:""}
      <div class="summary-grid">
        ${g("BaseURL",e.detectedBaseUrl||"未识别")}
        ${g("入口文件",e.entryFile||"index.html")}
        ${g("挂载路径",e.mountPath||"-")}
        ${g("端口",e.port?String(e.port):"-")}
        ${g("运行状态",T(e.active))}
      </div>
    </section>
  `}function Z(e){return`
    <div class="tabs">
      ${[["overview","概览"],["publish","发布"],["files","文件"],["versions",`版本 ${t.versions.length}`],["settings","设置"]].map(([s,n])=>`<button class="${t.activeProjectTab===s?"active":""}" data-action="set-tab" data-tab="${s}">${n}</button>`).join("")}
      <button class="ghost danger" data-action="delete-project" data-id="${e.id}">删除项目</button>
    </div>
  `}function J(e){switch(t.activeProjectTab){case"publish":return K(e);case"files":return X(e);case"versions":return G(e);case"settings":return Q(e);default:return W(e)}}function W(e){return`
    <section class="content-grid">
      <div class="panel">
        <div class="panel-head">
          <h3>运行状态</h3>
          <span>${e.active?e.currentVersionId?"已发布":"等待发布":"已停用"}</span>
        </div>
        ${re(e.warnings)}
        ${e.active?e.currentVersionId?`<div class="status-card success">
                <strong>当前项目可访问</strong>
                <span>访问模式为 ${$(e.accessMode)}，分享状态为 ${w(e.shareState)}。</span>
              </div>`:`<div class="status-card">
                <strong>还没有发布版本</strong>
                <span>上传 ZIP 构建产物或单 HTML 文件后，系统会识别 BaseURL 并生成访问地址。</span>
                <button class="primary" data-action="set-tab" data-tab="publish">去发布</button>
              </div>`:`<div class="status-card">
                <strong>项目已停用</strong>
                <span>访问模式为 ${$(e.accessMode)}，分享状态为 ${w(e.shareState)}。</span>
              </div>`}
      </div>
      <div class="panel">
        <div class="panel-head">
          <h3>快捷操作</h3>
          <span>常用流程</span>
        </div>
        <div class="quick-grid">
          <button data-action="set-tab" data-tab="publish">上传新版本</button>
          <button data-action="set-tab" data-tab="files" ${e.currentVersionId?"":"disabled"}>管理文件</button>
          <button data-action="set-tab" data-tab="versions" ${t.versions.length?"":"disabled"}>查看版本</button>
          ${e.currentVersionId?`<a class="button-link" href="${d(r.packageExeUrl(e.id))}">下载 EXE</a>`:"<button disabled>下载 EXE</button>"}
          <button data-action="set-tab" data-tab="settings">调整设置</button>
        </div>
      </div>
    </section>
  `}function K(e){return`
    <section class="panel">
      <div class="panel-head">
        <h3>发布项目</h3>
        <span>当前版本 ${e.currentVersionId||"-"}</span>
      </div>
      <div class="publish-grid">
        <div class="upload-box">
          <strong>ZIP 构建产物</strong>
          <span>适合 Vite、Vue、React、Webpack 构建后的 dist 目录压缩包。</span>
          <label>选择 ZIP<input name="zip" type="file" accept=".zip" data-file="zip" /></label>
          <button class="primary" data-action="publish-zip" data-id="${e.id}">上传 ZIP</button>
        </div>
        <div class="upload-box">
          <strong>单 HTML 文件</strong>
          <span>上传后会保存为 index.html，并直接生成访问地址。</span>
          <label>选择 HTML<input name="html" type="file" accept=".html,.htm,text/html" data-file="html" /></label>
          <button data-action="publish-html" data-id="${e.id}">上传 HTML</button>
        </div>
      </div>
    </section>
  `}function X(e){const a=t.filePath.split("/").filter(Boolean).slice(0,-1).join("/");return e.currentVersionId?`
    <section class="panel">
      <div class="panel-head">
        <h3>文件管理</h3>
        <span>${t.files.length} 项</span>
      </div>
      <div class="pathbar">
        <button data-action="open-path" data-path="">根目录</button>
        ${t.filePath?`<button data-action="open-path" data-path="${d(a)}">上级</button>`:""}
        <code>/${o(t.filePath)}</code>
      </div>
      <form class="file-upload" data-form="file">
        <input name="path" placeholder="保存路径，例如 assets/logo.png" required />
        <input name="file" type="file" required />
        <button class="primary" type="submit">上传/替换</button>
      </form>
      <div class="table-list file-table">
        ${t.files.map(_).join("")||'<p class="empty">空目录</p>'}
      </div>
    </section>
  `:`<section class="panel">${P("当前项目还没有版本，发布后才能管理文件。")}</section>`}function _(e){return`
    <div class="table-row">
      <button class="file-cell" data-action="${e.isDir?"open-path":"noop"}" data-path="${d(e.path)}">
        <span class="file-badge">${e.isDir?"DIR":"FILE"}</span>
        <span>${o(e.name)}</span>
      </button>
      <span>${e.isDir?"目录":H(e.size)}</span>
      <button class="ghost danger" data-action="delete-file" data-path="${d(e.path)}">删除</button>
    </div>
  `}function G(e){return`
    <section class="panel">
      <div class="panel-head">
        <h3>版本历史</h3>
        <span>${t.versions.length} 条</span>
      </div>
      <div class="table-list">
        ${t.versions.map(a=>`
              <div class="table-row">
                <div>
                  <strong>#${a.versionNumber}</strong>
                  <span>${o(a.sourceType)} · ${H(a.sizeBytes)} · ${L(a.createdAt)}</span>
                </div>
                <span>${o(a.detectedBaseUrl||"未识别")}</span>
                <button data-action="activate-version" data-version="${a.id}" ${a.id===e.currentVersionId?"disabled":""}>激活</button>
              </div>`).join("")||'<p class="empty">暂无版本</p>'}
      </div>
    </section>
  `}function Q(e){return`
    <form class="panel" data-form="settings">
      <div class="panel-head">
        <h3>项目设置</h3>
        <span>低频配置</span>
      </div>
      <div class="field-grid">
        <label>名称<input name="name" value="${d(e.name)}" /></label>
        <label>项目标识<input name="slug" value="${d(e.slug)}" /></label>
        <label>入口文件<input name="entryFile" value="${d(e.entryFile)}" /></label>
        <label>挂载路径<input name="mountPath" value="${d(e.mountPath)}" placeholder="/demo/" /></label>
        <label>访问模式
          <select name="accessMode">
            ${m("path","路径",e.accessMode)}
            ${m("mount","挂载路径",e.accessMode)}
            ${m("port","独立端口",e.accessMode)}
          </select>
        </label>
        <label>分享状态
          <select name="shareState">
            ${m("public","公开",e.shareState)}
            ${m("share","分享令牌",e.shareState)}
            ${m("unshared","不分享",e.shareState)}
          </select>
        </label>
      </div>
      <label class="check"><input name="spaEnabled" type="checkbox" ${e.spaEnabled?"checked":""} /> SPA fallback</label>
      <div class="form-actions">
        <button class="primary" type="submit">保存设置</button>
      </div>
    </form>
  `}function Y(){if(t.me?.role!=="admin")return`<section class="panel">${P("需要管理员权限。")}</section>`;const e=O();return`
    <div class="workspace-stack">
      ${y()}
      <section class="view-head">
        <div>
          <span class="eyebrow">用户管理</span>
          <h1>账号与权限</h1>
        </div>
        <button class="primary" data-action="open-user-modal" data-mode="create">创建用户</button>
      </section>
      <section class="panel">
        <div class="panel-head">
          <h3>用户列表</h3>
          <span>${e.length} / ${t.users.length} 个账号</span>
        </div>
        <div class="user-toolbar">
          <input data-input="user-search" value="${d(t.userSearch)}" placeholder="搜索用户名、邮箱或角色" />
        </div>
        ${e.length?ee(e):'<p class="empty">没有匹配用户</p>'}
      </section>
    </div>
  `}function ee(e){return`
    <div class="user-table-wrap">
      <table class="user-table">
        <thead>
          <tr>
            <th>序号</th>
            <th>用户名</th>
            <th>邮箱</th>
            <th>角色</th>
            <th>状态</th>
            <th>创建时间</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          ${e.map((a,s)=>te(a,s)).join("")}
        </tbody>
      </table>
    </div>
  `}function te(e,a){const s=e.id===t.me?.id,n=!e.disabled;return`
    <tr>
      <td>${a+1}</td>
      <td><strong>${o(e.username)}</strong></td>
      <td>${e.email?o(e.email):'<span class="muted">未设置</span>'}</td>
      <td>${k(e.role)}</td>
      <td><span class="state-badge ${e.disabled?"disabled":"enabled"}">${e.disabled?"已禁用":"启用中"}</span></td>
      <td>${L(e.createdAt)}</td>
      <td>
        <div class="user-actions">
          <button data-action="open-user-modal" data-mode="edit" data-id="${e.id}">编辑</button>
          <button data-action="open-user-modal" data-mode="reset" data-id="${e.id}">重置密码</button>
          <button data-action="toggle-user" data-id="${e.id}" data-disabled="${n}" ${s&&n?"disabled":""}>
            ${e.disabled?"启用":"禁用"}
          </button>
        </div>
      </td>
    </tr>
  `}function ae(){const e=t.userModal,a=e.userId?t.users.find(i=>i.id===e.userId):null;if(e.mode!=="create"&&!a)return"";if(e.mode==="reset"&&a)return`
      <div class="modal-backdrop" role="presentation">
        <section class="modal-panel" role="dialog" aria-modal="true" aria-label="重置密码">
          <div class="modal-head">
            <div>
              <span class="eyebrow">重置密码</span>
              <h2>${o(a.username)}</h2>
            </div>
            <button class="ghost" type="button" data-action="close-user-modal">关闭</button>
          </div>
          <form class="modal-form" data-form="user-reset" data-user-id="${a.id}">
            <label>新密码<input name="password" type="password" autocomplete="new-password" minlength="8" required autofocus /></label>
            <div class="modal-actions">
              <button type="button" data-action="close-user-modal">取消</button>
              <button class="primary" type="submit">保存密码</button>
            </div>
          </form>
        </section>
      </div>
    `;const s=e.mode==="edit"&&!!a,n=a||null;return`
    <div class="modal-backdrop" role="presentation">
      <section class="modal-panel" role="dialog" aria-modal="true" aria-label="${s?"编辑用户":"创建用户"}">
        <div class="modal-head">
          <div>
            <span class="eyebrow">${s?"编辑用户":"创建用户"}</span>
            <h2>${s&&n?o(n.username):"新增账号"}</h2>
          </div>
          <button class="ghost" type="button" data-action="close-user-modal">关闭</button>
        </div>
        <form class="modal-form" data-form="${s?"user-edit":"user-create"}" ${s&&n?`data-user-id="${n.id}"`:""}>
          <label>用户名<input name="username" value="${d(n?.username||"")}" minlength="3" required autofocus /></label>
          <label>邮箱<input name="email" type="email" value="${d(n?.email||"")}" placeholder="name@example.com" ${s?"":"required"} /></label>
          ${s?"":'<label>初始密码<input name="password" type="password" autocomplete="new-password" minlength="8" required /></label>'}
          <label>角色
            <select name="role">
              ${m("user","用户",n?.role||"user")}
              ${m("admin","管理员",n?.role||"user")}
            </select>
          </label>
          ${s?`<label class="check"><input name="disabled" type="checkbox" ${n?.disabled?"checked":""} ${n?.id===t.me?.id?"disabled":""} /> 禁用账号</label>`:""}
          <div class="modal-actions">
            <button type="button" data-action="close-user-modal">取消</button>
            <button class="primary" type="submit">${s?"保存用户":"创建用户"}</button>
          </div>
        </form>
      </section>
    </div>
  `}function se(){if(t.me?.role!=="admin")return`<section class="panel">${P("需要管理员权限。")}</section>`;const e=t.publicHostInfo?.publicHost||"未设置";return`
    <div class="workspace-stack">
      ${y()}
      <section class="view-head">
        <div>
          <span class="eyebrow">分享地址</span>
          <h1>访问主机管理</h1>
        </div>
        <span>只有管理员可以修改项目访问地址使用的主机。</span>
      </section>
      <section class="panel">
        ${ne()}
      </section>
      <section class="panel">
        <div class="panel-head">
          <h3>地址生成规则</h3>
          <span>当前主机：${o(e)}</span>
        </div>
        <div class="info-list">
          <div><strong>管理后台</strong><span>继续使用 8080 端口，不受分享地址设置影响。</span></div>
          <div><strong>路径分享</strong><span>项目地址会按当前主机和 8081 分享端口生成。</span></div>
          <div><strong>独立端口</strong><span>端口模式项目会按当前主机和项目端口生成根路径访问地址。</span></div>
        </div>
      </section>
    </div>
  `}function ne(){const e=t.publicHostInfo,a=e?.candidates??[],s=e?.publicHost??"",n=s||"未设置",i=s?`${window.location.protocol}//${we(s)}:8081/`:"未设置";return`
    <div class="address-layout">
      <div class="address-current">
        <span class="eyebrow">当前地址</span>
        <h3>分享网关地址</h3>
        <code class="current-address">${o(i)}</code>
        <div class="address-meta">
          <div><strong>当前主机</strong><span>${o(n)}</span></div>
          <div><strong>项目链接</strong><span>路径分享使用 8081；独立端口项目使用项目自己的端口。</span></div>
        </div>
      </div>
      <form class="address-form" data-form="public-host">
        <div class="address-form-head">
          <h3>修改地址</h3>
          <span>选择检测到的本机地址，或输入自定义 IP / 主机名。</span>
        </div>
        <label>本机地址
          <select name="publicHost">
            ${a.map(l=>m(l,l,s)).join("")}
          </select>
        </label>
        <label>自定义地址
          <input name="customHost" placeholder="例如 192.168.1.20 或 host.local" />
        </label>
        <div class="form-actions">
          <button class="primary" type="submit">保存地址</button>
        </div>
        <div class="hint">保存后会刷新项目列表和项目访问地址。</div>
      </form>
    </div>
  `}function ie(){return`
    <section class="empty-state">
      <h2>还没有项目</h2>
      <p>在中栏创建项目后，上传 ZIP 或 HTML 即可获得访问地址。</p>
    </section>
  `}function P(e){return`<div class="inline-empty">${o(e)}</div>`}function re(e){const a=e??[];return a.length?`<ul class="warnings">${a.map(s=>`<li>${o(s)}</li>`).join("")}</ul>`:""}function y(){return`${t.error?`<div class="notice error">${o(t.error)}</div>`:""}${t.message?`<div class="notice">${o(t.message)}</div>`:""}`}function oe(){h.querySelectorAll("form").forEach(e=>e.addEventListener("submit",ue)),h.querySelectorAll("[data-action]").forEach(e=>e.addEventListener("click",pe)),h.querySelector('[data-input="project-search"]')?.addEventListener("input",le),h.querySelector('[data-input="user-search"]')?.addEventListener("input",ce),h.querySelector('[data-change="share-filter"]')?.addEventListener("change",de)}function le(e){t.projectSearch=e.currentTarget.value,p()}function ce(e){t.userSearch=e.currentTarget.value,p()}function de(e){t.projectShareFilter=e.currentTarget.value,p()}async function ue(e){e.preventDefault();const a=e.currentTarget,s=new FormData(a);await M(async()=>{switch(a.dataset.form){case"login":{const{user:n}=await r.login(String(s.get("username")),String(s.get("password")));t.me=n,t.activeView="projects",await u();break}case"project":{const n=s.get("file"),i=n instanceof File&&n.size>0?n:null,l=i?me(i):null,{project:b}=await r.createProject({name:String(s.get("name"))});t.selectedId=b.id,t.activeProjectTab="overview",t.createModalOpen=!1,await u(),i&&l==="zip"&&await r.publishZip(b.id,i),i&&l==="html"&&await r.publishHtml(b.id,i),await u();break}case"settings":await be(a);break;case"file":await he(a);break;case"user-create":await r.createUser({username:String(s.get("username")),email:String(s.get("email")),password:String(s.get("password")),role:String(s.get("role"))}),t.userModal=null,await v();break;case"user-edit":await ve(a);break;case"user-reset":await fe(a);break;case"public-host":{const n=String(s.get("customHost")||"").trim(),i=String(s.get("publicHost")||"").trim();await r.updatePublicHost(n||i),await u();break}}})}async function pe(e){const a=e.currentTarget,s=a.dataset.action;if(s!=="noop"){if(s==="set-view"){const n=a.dataset.view||"projects";t.activeView=t.me?.role==="admin"||n==="projects"?n:"projects",t.createModalOpen=!1,t.userModal=null,t.error="",t.message="";try{t.activeView==="users"&&await v(),t.activeView==="share"&&await E()}catch(i){t.error=i instanceof Error?i.message:"加载视图失败"}p();return}if(s==="set-tab"){t.activeProjectTab=a.dataset.tab||"overview",t.error="",t.message="",p();return}if(s==="select-project"){t.selectedId=Number(a.dataset.id),t.filePath="",t.shareUrl="",t.activeProjectTab="overview",t.error="",t.message="",await S(),p();return}if(s==="open-path"){t.filePath=a.dataset.path||"",t.error="",t.message="",await S(),p();return}if(s==="open-create-modal"){t.createModalOpen=!0,t.error="",t.message="",p();return}if(s==="close-create-modal"){t.createModalOpen=!1,t.error="",t.message="",p();return}if(s==="open-user-modal"){t.userModal={mode:a.dataset.mode||"create",userId:Number(a.dataset.id)||void 0},t.error="",t.message="",p();return}if(s==="close-user-modal"){t.userModal=null,t.error="",t.message="",p();return}await M(async()=>{const n=f();switch(s){case"logout":await r.logout(),t.me=null,t.activeView="projects",t.selectedId=null;break;case"copy-link":await $e(a.dataset.url||""),t.message="访问地址已复制";break;case"publish-zip":await I("zip");break;case"publish-html":await I("html");break;case"share-token":if(n){const i=await r.shareToken(n.id);t.shareUrl=i.shareUrl,await u()}break;case"activate-project":n&&(await r.activateProject(n.id),await u());break;case"deactivate-project":n&&confirm("确认停用该项目？")&&(await r.deactivateProject(n.id),await u());break;case"activate-version":n&&await r.activateVersion(n.id,Number(a.dataset.version)),t.activeProjectTab="overview",await u();break;case"delete-file":n&&confirm("确认删除该路径？")&&(await r.deleteFile(n.id,a.dataset.path||""),await u());break;case"delete-project":n&&confirm("确认删除该项目？")&&(await r.deleteProject(n.id),t.selectedId=null,await u());break;case"toggle-user":await ge(Number(a.dataset.id),a.dataset.disabled==="true");break}})}}function me(e){const a=e.name.toLowerCase();if(a.endsWith(".zip"))return"zip";if(a.endsWith(".html")||a.endsWith(".htm"))return"html";throw new Error("创建时只支持上传 ZIP、HTML 或 HTM 文件")}async function be(e){const a=f();if(!a)return;const s=new FormData(e);await r.updateProject(a.id,{name:String(s.get("name")),slug:String(s.get("slug")),entryFile:String(s.get("entryFile")),mountPath:String(s.get("mountPath")),accessMode:String(s.get("accessMode")),shareState:String(s.get("shareState")),spaEnabled:!!s.get("spaEnabled")}),t.activeProjectTab="overview",await u()}async function I(e){const a=f();if(!a)return;const n=h.querySelector(`input[data-file="${e}"]`)?.files?.[0];if(!n)throw new Error("请选择文件");e==="zip"?await r.publishZip(a.id,n):await r.publishHtml(a.id,n),t.activeProjectTab="overview",await u()}async function he(e){const a=f();if(!a)return;const s=new FormData(e),n=s.get("file");if(!(n instanceof File))throw new Error("请选择文件");await r.putFile(a.id,String(s.get("path")),n),await u(),t.activeProjectTab="files"}async function ve(e){const a=Number(e.dataset.userId),s=t.users.find(b=>b.id===a);if(!s)throw new Error("用户不存在");const n=new FormData(e),i=s.id===t.me?.id?!1:!!n.get("disabled"),{user:l}=await r.updateUser(a,{username:String(n.get("username")),email:String(n.get("email")),role:String(n.get("role")),disabled:i});t.me?.id===l.id&&(t.me=l),t.userModal=null,await v()}async function fe(e){const a=Number(e.dataset.userId),s=String(new FormData(e).get("password"));await r.resetPassword(a,s),t.userModal=null,await v()}async function ge(e,a){const s=t.users.find(n=>n.id===e);if(!s)throw new Error("用户不存在");await r.updateUser(e,{username:s.username,email:s.email||"",role:s.role,disabled:a}),await v()}async function M(e){t.error="",t.message="";try{await e(),t.message||(t.message="操作完成")}catch(a){t.error=a instanceof Error?a.message:"操作失败"}p()}async function $e(e){if(!e)throw new Error("没有可复制的地址");if(navigator.clipboard?.writeText){await navigator.clipboard.writeText(e);return}const a=document.createElement("textarea");a.value=e,a.style.position="fixed",a.style.opacity="0",document.body.appendChild(a),a.select(),document.execCommand("copy"),a.remove()}function g(e,a){return`<div class="summary-item"><span>${o(e)}</span><strong>${o(a)}</strong></div>`}function m(e,a,s){return`<option value="${e}" ${e===s?"selected":""}>${a}</option>`}function k(e){return e==="admin"?"管理员":"用户"}function T(e){return e?"运行中":"已停用"}function $(e){return{path:"路径",mount:"挂载",port:"端口"}[e]||e}function w(e){return{public:"公开",share:"令牌分享",unshared:"不分享"}[e]||e}function H(e){return e<1024?`${e} B`:e<1024*1024?`${(e/1024).toFixed(1)} KB`:`${(e/1024/1024).toFixed(1)} MB`}function L(e){return e?new Date(e).toLocaleString("zh-CN",{hour12:!1}):"-"}function o(e){return String(e??"").replace(/[&<>"']/g,a=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[a])}function d(e){return o(e||"")}function we(e){return e.includes(":")&&!e.startsWith("[")?`[${e}]`:e}U();
