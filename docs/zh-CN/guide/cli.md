# 命令行 `curl`、SSH 与 iOS 快捷指令

除了浏览器登录外，GCopy 的 `/api/v1/clipboard` 接口原生支持 `Authorization: Bearer <8位令牌>` 请求头。无需在远程服务器上安装任何客户端，直接用系统自带的 `curl` 或 iPhone「快捷指令」即可与电脑剪贴板双向同步。

## 1. 使用 `curl` 同步（SSH 远程服务器利器）

将下方示例中的 `G8K2P9X4` 替换为你的 8 位令牌（自建用户请将 `https://gcopy.link` 替换为自己的域名）。

### 从远程服务器推送文本/命令输出到本地剪贴板

```bash
# 将任意命令输出或文件内容直接推入 GCopy
cat /etc/nginx/nginx.conf | curl -fsSL https://gcopy.link/api/v1/clipboard \
  -H "Authorization: Bearer G8K2P9X4" \
  --data-binary @-
```

执行后，回到本地电脑浏览器点一下 **同步剪贴板** 即可直接 `Ctrl+V` / `Cmd+V` 粘贴！

### 在远程终端拉取电脑刚复制的内容

```bash
curl -fsSL https://gcopy.link/api/v1/clipboard \
  -H "Authorization: Bearer G8K2P9X4"
```

### 从远程服务器推送文件到本地电脑

只需附带 `X-FileName` 请求头（含空格、百分号或中文的文件名建议做百分号编码，或直接使用下方的 `gpush` 函数自动处理）：

```bash
curl -fsSL https://gcopy.link/api/v1/clipboard \
  -H "Authorization: Bearer G8K2P9X4" \
  -H "X-FileName: app.log" \
  --data-binary @/var/log/app.log
```

### 推送图片作为系统剪贴板截图

```bash
curl -fsSL https://gcopy.link/api/v1/clipboard \
  -H "Authorization: Bearer G8K2P9X4" \
  -H "Content-Type: image/png" \
  --data-binary @diagram.png
```

---

## 2. 配置极简 Shell 快捷函数（`gpush` / `gpull`）

把下面这段脚本加到服务器的 `~/.bashrc` 或 `~/.zshrc` 中（已兼容 `bash` 与 `zsh`、`set -u` 严格模式，并纯 POSIX 自动编码中文/空格/特殊符号文件名，不依赖 Python）：

```bash
export GCOPY_URL="https://gcopy.link"
export GCOPY_TOKEN="G8K2P9X4"

# 用法：
#   cat error.log | gpush          （管道推送标准输入文本）
#   gpush "./测试 报告 100%.pdf"    （直接推送任意文件，自动编码中文与特殊字符）
gpush() {
  if [ -n "${1:-}" ]; then
    if [ ! -f "$1" ]; then
      echo "gpush: file not found: $1" >&2
      return 1
    fi
    local raw_name encoded_name
    raw_name=$(basename "$1")
    encoded_name=$(printf '%s' "$raw_name" | LC_ALL=C od -An -tx1 -v | tr ' ' '\n' | awk 'NF { printf "%%%s", toupper($1) }')
    curl -fsSL "$GCOPY_URL/api/v1/clipboard" \
      -H "Authorization: Bearer $GCOPY_TOKEN" \
      -H "X-FileName: $encoded_name" \
      --data-binary "@$1" >/dev/null
  else
    curl -fsSL "$GCOPY_URL/api/v1/clipboard" \
      -H "Authorization: Bearer $GCOPY_TOKEN" \
      --data-binary @- >/dev/null
  fi
}

# 用法：
#   gpull                          （将文本剪贴板输出到终端）
#   gpull > archive.tar.gz         （保存二进制文件剪贴板）
gpull() {
  curl -fsSL "$GCOPY_URL/api/v1/clipboard" \
    -H "Authorization: Bearer $GCOPY_TOKEN"
}
```

---

## 3. 接入 iOS「快捷指令」（iPhone / iPad）

在 iPhone 自带的「快捷指令（Shortcuts）」App 中，按下方动作顺序配置即可免开浏览器同步。

> [!IMPORTANT]
> 配置 iOS 快捷指令时请注意两个 iOS 系统特性（下方步骤已针对性规避）：
> 1. **网址防抓取**：在 Safari 复制链接时，iOS 剪贴板类型是 `URL`；若直接塞进 `POST` 的「文件」请求体，iOS 快捷指令会自动去抓取该网页的 HTML 源码上传，而不是上传网址本身——中间加一步**「从输入中获取文本」**即可完美解决。
> 2. **HEIC 图片格式兼容**：iPhone 相册复制的照片默认是 `HEIC` 格式，Windows 浏览器剪贴板无法直接解析——推送图片前加一步**「转换图像 → PNG」**即可全平台通用。

### 快捷指令 A：推送手机文字 / 链接 → 电脑
1. **获取剪贴板**（Get Clipboard）
2. **从输入中获取文本**（Get Text from Input，输入选「剪贴板」）
3. **获取 URL 内容**（Get Contents of URL，地址填 `https://gcopy.link/api/v1/clipboard`）
   - **方法**：`POST`
   - **头部**：添加 `Authorization`，值为 `Bearer G8K2P9X4`
   - **请求体**：选择 **文件（File）** → 变量选第 2 步的 **文本**

### 快捷指令 B：推送手机截图 / 照片 → 电脑
1. **获取剪贴板**（Get Clipboard）
2. **转换图像**（Convert Image，将「剪贴板」转换为 **PNG**）
3. **获取 URL 内容**（Get Contents of URL，地址填 `https://gcopy.link/api/v1/clipboard`）
   - **方法**：`POST`
   - **头部**：添加 `Authorization`，值为 `Bearer G8K2P9X4`（*切勿手动填写 `Content-Type`，快捷指令会自动附带 `image/png`*）
   - **请求体**：选择 **文件（File）** → 变量选第 2 步的 **转换后的图像**

### 快捷指令 C：拉取电脑剪贴板 → 手机（文字与截图通用）
1. **获取 URL 内容**（地址填 `https://gcopy.link/api/v1/clipboard`，方法 `GET`，头部添加 `Authorization`: `Bearer G8K2P9X4`）
2. **如果（If）**「URL 的内容」**有任何值（has any value）**：
   - **拷贝至剪贴板**（Copy to Clipboard，传入「URL 的内容」）

> [!TIP]
> 在 iPhone **设置 → 辅助功能 → 触控 → 轻点背面（轻点两下）** 中绑定上述快捷指令，在任意 App 里复制后敲两下手机背面即可秒推到电脑！
