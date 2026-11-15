# 地图 Review 实机媒体与阶段记录

| 阶段 | 源码SHA | 实际证据 |
| --- | --- | --- |
| 手机入口与性能基线 | 1b2189e | [基线截图](stage-a-baseline.jpg)、[性能概要](stage-a-performance.json)、[完整原始帧](stage-a-frames.json.gz) |
| 音频暂停与恢复 | 2632ee8 | [恢复截图](stage-a-audio-recovery.jpg)，真实Web Desktop运行验证 |
| 旧图配置迁移与共用地图 | 4e554a0 | [实际发布版共用地图](stage-b-shared-map.jpg)，原30项与13项新增测试通过 |

音频修复在提交前完成构建与GREEN检查，构建戳保留父提交0198d1c与dirty标记，所测代码随后提交为2632ee8。基线视口1512×777，早期音频操作也使用1512×833。后续视觉对比统一1512×777与标准画质。

局域网地址仅在同一Wi-Fi和本机服务运行时使用。实体手机双指、安全区、文件选择、音频启动/锁屏/后台、外部音乐App共存均未测。早期基线包含停留观察，最终六单整段验证记录如下。

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

## 唐人街完整送单与换区阶段

`verified-chinatown-*` 与 `verified-four-swaps.png` 同样来自 `c0294c2` 的同一个运行实例。CT-1045 / CT-1046 / CT-1047 为1515m / 363s、1289m / 310s、1574m / 408s，累计六单 $63.00。覆盖珍巷面馆、莫街蒸馆和 East Broadway / Henry / Mulberry 三个入口。

Doyers 为实际下车步行通路，汽车走 Pell 与周边单行路。四次换区记录保留播放中与主动暂停状态，地区独有 prefab 数在18与19之间切换。完整整段采样与视频状态见最终集成验证。

## 最终构建与集成证据

最终功能代码 `71c33fd`，Creator 3.8.8独立干净导入构建成功，正常发布目录game/build/web-desktop，构建戳dirty=false，65项测试通过、0跳过。原始日志留在本机.local/maps-evidence。

| 实际媒体 | 源码SHA与条件 |
| --- | --- |
| latest-flushing-map.png、final-ready.png | 71c33fd，1512×777、标准，正常试玩入口 |
| final-silent-delivery.png、final-camera-switch.png、camera-switch.txt | 71c33fd，静音完整送达后从步行结束态换区，驾驶位当前与峰值均为零 |
| latest-chinatown-map.png、latest-*-result.png | 360d278，两区各一单完整补录过程 |
| latest-touch-landscape.png、latest-touch-portrait.png、portrait-*-layout.json | 360d278，桌面844×390与390×844，面板边界检查通过 |
| quality-low.png、quality-standard.png、quality-*-latest.json | 23a9fa8，完全相同出生机位、画幅和视角，后视镜两档均可见，原始帧导出截断已注明 |
| whole-run.json、whole-run-frames.json.gz、startup.json | c0294c2，六单与四次换区的完整统计、所有原始帧及独立启动180帧 |

活跃送单1809.597秒、108290帧，平均59.84FPS，p95 18.6ms、p99 22.7ms，超过50ms共46帧，超过100ms为0。暂停、空闲、启动和后台单列。资源及内存取得范围见VALIDATION。

### 两区完整有声视频

- [法拉盛完整订单](flushing-delivery.mp4)，FL-1042，829米、167秒，视频170.13秒。
- [唐人街完整订单](chinatown-delivery.mp4)，CT-1043，1511米、363秒，视频366.90秒。

源码360d278，实际Cocos Web Desktop / M2 Pro / Brave / 1512×777 / DPR2 / 标准画质。视频覆盖接单、合法路网驾驶、步行入店、核码、装餐、送达与结算。原始画面由CUA按约7.35帧/秒中位采样，真实时间戳保留批次间停留，最长采集空档26.693秒以最近画面延续。最终缩放至1280×658，30FPS编码含重复帧，流程时长保持真实。

Mac锁屏导致系统视频或音轨录制失败，因此交付视频后期混入项目原创 Evening on Orchard、River Lights，CC0 1.0，可分发和公开宣传使用。视频中的环境和提示声未实际录得。实时音频恢复的独立阶段A记录继续保留。完整视频元数据、音量及SHA-256见video-metadata.json，采样时间索引为capture-index.json.gz。原始画面、转换中间文件与失败录屏保留于本机.local/media。

本轮实体手机连接、双指、锁屏恢复、手机文件选择、外部音乐App同时播放与手机15分钟性能全部未测。当前同一Wi-Fi入口为电脑192.168.0.193:7476，服务保持运行，地址随电脑网络变化。

可在仓库根目录重跑实际观测检查。

```bash
node tests/map-run.integration.mjs docs/media/maps-20261115/whole-run.json
node tests/startup-telemetry.integration.mjs docs/media/maps-20261115/startup.json
node tests/touch-panels.integration.mjs docs/media/maps-20261115/portrait-order-layout.json
node tests/driver-camera.integration.mjs docs/media/maps-20261115/camera-switch.txt
```
