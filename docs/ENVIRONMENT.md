# 环境与下载诊断

## 实际设备

2026-11-14 在用户本机执行，时区 America/New_York。

| 项目 | 观测结果 |
| --- | --- |
| 系统 | macOS 26.5.2，build 25F84 |
| 内核与架构 | Darwin 25.5.0，arm64 |
| 初始可用空间 | 约 50 GiB |
| Dashboard | /Applications/CocosDashboard.app，2.2.2，通用二进制 |
| Creator | 3.8.8，独立安装于 ~/Applications/Cocos-3.8.8/CocosCreator.app |
| 设备 | Apple M2 Pro，16 GiB 内存 |
| 开发运行时 | Node 26.8.2，npm 11.19.1，Python 3.9 系统版 |
| 仓库 | GitHub API isEmpty=true，git ls-remote 成功且没有 refs |

## 失败证据

- 失败层级为 A，Dashboard 下载或安装 Creator。初始编辑器列表已有 3.8.8 下载失败项。
- 09:29 左右在原入口选择“继续下载”，立即再次显示“Cocos Creator 3.8.8 安装失败”。
- Dashboard 实际记录的包为 CocosCreator-v3.8.8-mac-ui-102721.zip，下载实现记录为 axios-slice。
- 来源为 download.cocos.com/CocosCreator/v3.8.8/，目标为系统临时目录 CocosDashboard 下同名 ZIP。观测时该临时目录不存在，进度记录为 0%。这项证据尚不足以确定根因。
- 同一 URL 的终端 HTTPS HEAD 返回 200、application/zip、1242717664 字节，重定向 0 次。请求首个 1048576 字节返回 206，文件识别为 ZIP。
- 系统 HTTP、HTTPS 与 SOCKS 代理均指向本地 7890。未修改代理、VPN、DNS 或 TLS 验证。
- 退出 Dashboard 后重新从实际二进制启动并将 stdout/stderr 保存在本机 .local/environment/dashboard.log。初始日志未给出下载错误码。原始配置备份同样仅保存在 .local/environment。
- 使用用户授权的账号在 Dashboard 复测登录，等待后显示“由于没有连上网络，将跳过登录”。账号信息未写入仓库。
- 重启并重新下载后取得明确错误 `getCdnUrl failed: user not logged in`，调用栈位于 Dashboard editor/cdn-url.ccc 的 getCdnUrl，再进入 downloadCreatorInner。当前下载入口在取得登录关联 CDN 地址阶段失败。
- 直连和显式使用本地 HTTP 代理访问官方版本接口都返回 HTTP 200。登录服务的联网失败仍需单独调查。
- 读取当前 Dashboard 内置 @editor/user 的实际请求实现，登录端点为官方 creator-api.cocos.com/api/account/signin，使用 Node HTTPS 与 8 秒请求超时。空参数的 Node 请求约 0.6 秒返回 Missing Username。使用用户授权账号的独立 HTTPS 请求约 0.96 秒返回 status=0、登录成功，响应会话数据仅在进程内存中处理。由此确认账号有效且终端登录链路可用，Dashboard 应用内请求失败仍待原入口定位。

## 当前处理

### 已修复

尚无足够证据宣称原下载问题已修复。

### 已验证的绕行

从 Cocos 官方版本接口取得 3.8.8 完整包 CocosCreator-v3.8.8-mac-121518.zip，下载完成为 1181883559 字节，ZIP 全文件 CRC 检查通过，codesign --verify --deep --strict 通过。应用版本为 3.8.8，通用二进制包含 arm64 与 x86_64。

本地 SHA-256 为 cc65c3665539e996c076fa8202dee8531b8770e7e956f0c68f610537735d640c。此值用于本地复核，官方接口未提供可比对校验值。

首次放置于 Dashboard 失败项原计划的 /Applications/Cocos/Creator/3.8.8。尝试添加该本地版本后，检查发现该目录消失。随后重新从已验证 ZIP 解压到独立用户目录 ~/Applications/Cocos-3.8.8。原失败项配置备份仍在本机，未继续使用其安装目标。

独立安装路径已完成真实工程导入，Creator UI 显示 Orchard.scene 与 Delivery Demo 脚本绑定。Web Desktop 构建多次返回 36，产物可由本机 HTTP 打开，已实际完成一单。

编辑器使用该版本实际启动代码支持的 --nologin 参数打开，构建通过正式 --project 与 --build 接口执行。脚本支持 COCOS_CREATOR 覆盖路径。

10:10 后完成 Dashboard“添加本地版本”，列表显示正确的用户安装路径，原“编辑器丢失”提示消失。随后通过“导入项目”选取仓库 game 目录，项目列表显示 game、Creator 3.8.8，双击后实际打开工程。Dashboard 当前也已显示登录状态。原下载入口尚未重新下载验证。

### 仍待确认

Dashboard 登录请求超时的具体网络原因，及登录恢复后原下载入口能否成功。Creator 同时记录 Request timeout, aborting 与 Failed to connect to login server: socket hang up，工程离线打开与 Web 构建已经可用。

本轮未执行原生平台下载、Android/iOS 构建或 external 版本替换。

## 恢复方式

本轮未修改网络全局配置。Dashboard 配置修改前的副本保存在 .local/environment，安装包与原始日志保留在本机。恢复时应先退出相关应用，再按实际修改项恢复对应文件。

## 官方依据

安装与本地版本管理参照 [Cocos 3.8 安装文档](https://docs.cocos.com/creator/3.8/manual/en/getting-started/install/)。

完整包来源为 [Cocos 官方版本接口](https://creator-api.cocos.com/api/cocoshub/editor_version_list?lang=zh&ver=2.2.2)。

构建参数与成功码 36 参照 [Cocos 3.8 命令行构建文档](https://docs.cocos.com/creator/3.8/manual/en/editor/publish/publish-in-command-line.html)。
