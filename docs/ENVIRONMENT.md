# 环境与下载诊断

## 实际设备

2026-11-14 在用户本机执行，时区 America/New_York。

| 项目 | 观测结果 |
| --- | --- |
| 系统 | macOS 26.5.2，build 25F84 |
| 内核与架构 | Darwin 25.5.0，arm64 |
| 初始可用空间 | 约 50 GiB |
| Dashboard | /Applications/CocosDashboard.app，2.2.2，通用二进制 |
| Creator | 初始未安装，目标版本 3.8.8 |
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
- 登录界面显示失败，已请用户自行完成登录。凭据不进入文档与仓库。

## 当前处理

### 已修复

尚无足够证据宣称原下载问题已修复。

### 绕行验证中

从 Cocos 官方版本接口取得 3.8.8 完整包 CocosCreator-v3.8.8-mac-121518.zip，HTTP HEAD 返回 200、1181883559 字节。计划完成 ZIP 完整性、包版本和代码签名检查后安装与打开验证。

### 仍待确认

Dashboard 分段下载的错误码与根因，以及官方完整包能否完成本机工程构建。

## 恢复方式

本轮未修改网络全局配置。Dashboard 配置修改前的副本保存在 .local/environment，安装包与原始日志保留在本机。恢复时应先退出相关应用，再按实际修改项恢复对应文件。

## 官方依据

安装与本地版本管理参照 [Cocos 3.8 安装文档](https://docs.cocos.com/creator/3.8/manual/en/getting-started/install/)。

完整包来源为 [Cocos 官方版本接口](https://creator-api.cocos.com/api/cocoshub/editor_version_list?lang=zh&ver=2.2.2)。

构建参数与成功码 36 参照 [Cocos 3.8 命令行构建文档](https://docs.cocos.com/creator/3.8/manual/en/editor/publish/publish-in-command-line.html)。
