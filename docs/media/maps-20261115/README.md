# 地图 Review 实机媒体与阶段记录

| 阶段 | 源码SHA | 实际证据 |
| --- | --- | --- |
| 手机入口与性能基线 | 1b2189e | [基线截图](stage-a-baseline.jpg)、[性能概要](stage-a-performance.json)、[完整原始帧](stage-a-frames.json.gz) |
| 音频暂停与恢复 | 2632ee8 | [恢复截图](stage-a-audio-recovery.jpg)，真实Web Desktop运行验证 |
| 旧图配置迁移与共用地图 | 4e554a0 | [实际发布版共用地图](stage-b-shared-map.jpg)，原30项与13项新增测试通过 |

音频修复在提交前完成构建与GREEN检查，构建戳保留父提交0198d1c与dirty标记，所测代码随后提交为2632ee8。基线视口1512×777，早期音频操作也使用1512×833。后续视觉对比统一1512×777与标准画质。

局域网地址仅在同一Wi-Fi和本机服务运行时使用。实体手机双指、安全区、文件选择、音频启动/锁屏/后台、外部音乐App共存均未测。桌面采样包含停留观察，15分钟完整送单验证将另行记录。

## 法拉盛首轮运行

源码 `748a7cb`，Creator 3.8.8 发布目录 `.local/maps-flushing-output/web-desktop`。构建标记为 `d5122de` 加当时未提交源码，随后以 `748a7cb` 固化。49 项测试通过，实际运行于同一台 M2 Pro / Brave / 1512×777 / DPR2。

- `stage-c-flushing-map.png` 为游戏内共用地图，含真实街名、方向、取送点与当前路线。
- `stage-c-noodle-entry.png`、`stage-c-noodle-counter.png` 为实际步行进入槐香面馆、排队后的运行截图。
- `stage-c-noodle-front.png` 为门前玻璃视角。此阶段完成真实街块可驾驶灰盒及第一家店的入口与柜台。
- 此阶段尚未完成三单验收、曼哈顿、15分钟连续测试和实体手机测试。窄路口转弯半径仍待调整。

地图来自 NYC Street Centerline 与 Building Footprints，准确查询、日期和校验见 `docs/maps/flushing-source.json`。店名、室内和停车标记为原创游戏布置，路边停车规则尚未逐个核实实地标牌。

## 法拉盛完整送单阶段

以下 `verified-flushing-*` 截图均来自干净构建 `c0294c2`，1512×777、DPR2、标准画质，正常键鼠与可见情境按钮操作。地图、面店柜台、饺子店柜台、驾驶舱、住宅门口及门厅均为实际 Cocos Web Desktop 运行。

三单依次为 FL-1042 / FL-1043 / FL-1044，810m / 165s、1651m / 356s、858m / 208s，累计 $31.50。覆盖两店与三个不同入口。第三单在距停车目标较远处下车，步行送达阶段约52秒，保留该实际操作结果。
