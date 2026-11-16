# 地图 Review 实机媒体与阶段记录

新增[Review 5913985157实测与TapTap入口](../review-5913985157/README.md)，保存步行裁剪、车载画面调度、音频异步竞态与本轮对应SHA。下文保留原地图阶段的源码与媒体版本。

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
| native-*-result.png、native-ready.png、native-run-diagnostics.txt | 71c33fd，解锁后同实例两单连续原声录制 |
| whole-run.json、whole-run-frames.json.gz、startup.json | c0294c2，六单与四次换区的完整统计、所有原始帧及独立启动180帧 |

活跃送单1809.597秒、108290帧，平均59.84FPS，p95 18.6ms、p99 22.7ms，超过50ms共46帧，超过100ms为0。暂停、空闲、启动和后台单列。资源及内存取得范围见VALIDATION。

### 解锁后两区连续原声视频

- [法拉盛完整订单](flushing-delivery.mp4)，源码71c33fd，FL-1042，813米、167.6秒，视频172.83秒。
- [唐人街完整订单](chinatown-delivery.mp4)，源码71c33fd，CT-1043，1518米、376.6秒，视频381.83秒。

实际Cocos Web Desktop / M2 Pro / Brave / 1512×777 / DPR2 / 标准画质。两单在同一运行实例完成，累计$20。ScreenCaptureKit连续录制游戏窗口及应用声音，麦克风关闭。截取完整订单的首尾，裁去浏览器工具栏，编码为1280×656、30FPS、H.264 / AAC、48kHz立体声。实际时间顺序与捕获的游戏音轨一并保留。

原始录制597.53秒、17017帧，采集帧间隔中位0.035秒、最大0.138333秒，时间戳与两单截取区间保存于native-frame-times.json.gz。原始文件留在本机.local/media/maps-native-complete.mp4。开始接单、驾驶、进店、核码、取餐、返车、送达与结算均在画面中核对。结果截图为native-flushing-result.png和native-chinatown-result.png，最后F3文本为native-run-diagnostics.txt。

录屏音乐模式使用项目原创 Evening on Orchard、River Lights，CC0 1.0。实际音乐和游戏合成声音随应用音轨捕获。法拉盛音轨均值-30.3dB、峰值-14.0dB，唐人街均值-30.4dB、峰值-13.8dB。两段均未检出持续一秒以上的-65dB静音。文件校验、编码和来源见video-metadata.json。

7bed882保存了锁屏时的分帧采集版本及后配音乐说明。其原始采样索引capture-index.json.gz继续作为历史记录保留，当前视频对应上述解锁后的连续实录。独立六单性能统计仍使用whole-run.json与完整原始帧。

本轮实体手机连接、双指、锁屏恢复、手机文件选择、外部音乐App同时播放与手机15分钟性能全部未测。该阶段使用的电脑局域网入口为192.168.0.193:7476。当前手机测试入口已按用户要求改为TapTap自测二维码，见新一轮记录。

可在仓库根目录重跑实际观测检查。

```bash
node tests/map-run.integration.mjs docs/media/maps-20261115/whole-run.json
node tests/startup-telemetry.integration.mjs docs/media/maps-20261115/startup.json
node tests/touch-panels.integration.mjs docs/media/maps-20261115/portrait-order-layout.json
node tests/driver-camera.integration.mjs docs/media/maps-20261115/camera-switch.txt
```
