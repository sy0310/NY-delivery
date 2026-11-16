# Review 5923195143 实际验收

最终功能源码 `51cb5fc1e5ecf874c678e9179bc120b575392aac`。基线为 PR HEAD `3449e38`，对应此前实际发布功能 `dc44b36`。环境为 Apple M2 Pro、16 GiB、macOS 26.5.2、Brave、Creator 3.8.8。所有图片来自实际 Cocos 发布产物。

用户补充旧包 `dc44b36` 的试玩手机为华为 Mate 60 Pro。系统版本与 TapTap 版本尚未提供，当前新包的实体手机结果尚未收到。

## 七项反馈

| 反馈 | 状态 | 实现与证据 |
| --- | --- | --- |
| 转向、交界穿插、碰撞卡住 | 已修复，手机手感待复测 | 低速最大轮角40°、输入6/s、刹车回正9/s。统一裁切路面，4.44×2.04m朝向车身检测，擦边保留合法切向移动。两区实际出现路缘受阻后均通过倒车和重新对线退出。见下方路口记录 |
| 关键路口宽度与通行一致 | 已修复 | 法拉盛两段38 AVE各加1.4m，唐人街两段Pell各加1.4m、Mosco加1.2m。原宽度保留在sourceWidth。建筑轮廓与禁行区继续裁切，渲染和车行检测读取同一surface |
| 空白远景 | 部分改善 | 70/165/280m三层共享材质楼群，加少量树灯剪影，天空、雾、背景地面协调。最终两区各八方向、两档真实截图可见城市轮廓。远景保持简化体块 |
| 原创纽约街面 | 部分改善 | 12组虚构品牌和原创图标，共享1024×512图集。营业时间、海报、窗帘、货箱、空调和路缘补丁按固定种子变化。有限近景细化，实际前后机位见下方 |
| 三种音乐来源 | 已修复，实际新面板文件导入待测 | 电台、本地歌曲、外部音乐使用独立来源页。高级设置折叠，横屏无横向溢出，暂停状态保持。原歌单、连续播放、录屏模式和音量逻辑回归通过 |
| 外部音乐操作 | 引导已实现，共存未测 | 主按钮应用游戏声音方案，界面引导用户通过系统最近任务或主屏幕打开音乐App。外部来源隐藏内部播放控件，返回按钮保留游戏暂停。外部曲库选曲与播放由对应App管理 |
| 手机横屏、双指及外部共存 | 桌面布局已测，实体项目未测 | 844×390与390×844发布版布局、可见按钮≥44px、无重叠回放通过。Mate 60 Pro新包双指、系统安全区和外部音乐混音仍待实体测试 |

## 阶段提交

| 阶段 | 提交 |
| --- | --- |
| 转向、道路、车身边界回归 | `b188458` |
| 统一可见路面、局部加宽与控制参数 | `be9d131` |
| 裁切多边形精度修正 | `496ed77` |
| 远景与原创街面回归 / 实现 | `61473bf` / `db68e59` |
| 初次HUD读取尚未加载的路网回归 / 修复 | `4cc5ece` / `d810619` |
| 暂停、来源界面与弯道导航回归 / 实现 | `1c80d0d` / `84ee448` |
| 倾斜车身前角穿出路面回归 / 修复 | `9cba0d8` / `35013b1` |
| 图集四边形UV回归 / 顶点顺序与距离提示修复 | `af1a366` / `0ac06c3` |
| 翻转Canvas的图集行号修正 | `51cb5fc` |

初次道路构建曾因诊断在区域加载前读取路网而启动失败，已在 `d810619` 修正并重新构建。近景实测发现图集拉花与错误行号，分别修正后重新跑最终两单。保留对应提交与阶段截图。

## 构建和回归

- 最终 `51cb5fc` 在独立干净工作树实际构建，Creator成功退出36，构建戳dirty=false，真实cc类型检查通过。该工作树在 `84ee448` 首次使用空library/temp导入，随后 `35013b1`、`0ac06c3`、`51cb5fc`分别增量构建，逐次检查Git清洁状态。
- 105项Node测试通过、0跳过。原90项覆盖继续运行，新增15项针对中速转向、可见路面、完整车身、初始加载、远景、品牌、导航弯道、暂停与外部界面。原窄路口用例在完成更小半径的转弯后继续直行，再核对通过位置。
- 独立Shapely几何回归通过，核对路面多边形有效性、不同通行层互斥、建筑退界、三角面面积与朝上绕序。
- 已加载模块覆盖率为行89.72%、分支92.45%、函数88.26%。World、车模与DOM的引擎表现另由实际构建和运行图片核对。
- [结构化验收数据](summary.json)、[横屏布局](driving-landscape.json)、[竖屏布局](driving-portrait.json)、[外部音乐状态](music-external-state.json)可直接用于回放。原始帧、控制台、构建日志保存在本机 `.local/review-5923195143`，结构化数据记录原始文件SHA256。

```bash
CREATOR_BUILD_DIR="$PWD/game/build/web-desktop" REQUIRE_CREATOR_BUILD=1 npm test
.local/road-tools/bin/python tests/street-surfaces.test.py
node tests/review-5923195143.integration.mjs
node tests/driving-ui.integration.mjs docs/media/review-5923195143/driving-landscape.json --music-shortcut
node tests/driving-ui.integration.mjs docs/media/review-5923195143/driving-portrait.json --music-shortcut
node tests/music-panel.integration.mjs docs/media/review-5923195143/music-external-state.json
```

## 实际两区送单

最终 `51cb5fc` 在同一运行实例，以正常键盘、鼠标、可见按钮完成两单与换区。视口1512×777、DPR1、标准画质。法拉盛包含Main/38th接缝专项行驶及较长步行交付，唐人街包含Doyers禁行与倒车专项。停车计时包含截图、读数与对线停留。

| 订单 | 汽车里程 | 总时长 | 取餐驾驶 / 送达驾驶 | 停车 / 取餐步行 / 等待 / 交接 / 返车 / 送达步行 |
| --- | ---: | ---: | --- | --- |
| FL-1042 | 905.05m | 419.70s | 107.30 / 52.82s | 201.11 / 33.69 / 0 / 0.34 / 6.88 / 17.56s |
| CT-1043 | 1521.77m | 731.22s | 189.87 / 110.90s | 275.94 / 36.52 / 6.00 / 12.33 / 62.40 / 37.25s |

累计$20。唐人街取餐使用1937码与匹配餐袋，法拉盛使用4826。电台从法拉盛结算后开始播放，换区、驾驶、步行、核餐与唐人街结算期间继续跨曲，最终HUD为Single player playing。真实系统输出声与手机外部音频混合本轮尚未录制。

[法拉盛结算](release-flushing-result.png) · [唐人街结算](release-chinatown-result.png) · [法拉盛取餐](release-flushing-counter.png) · [唐人街取餐](release-chinatown-counter.png)

最终版性能采样覆盖1122.278s活跃区间、67239帧，59.913FPS，p95 18.0ms、p99 21.3ms，超过50ms为5帧，超过100ms为0。采样在最后一次门口对位前停止，最终28.638s订单阶段没有进入该帧数组。结算后重新导出的订单与阶段日志完整记录两单，最后交付通过可见“交付餐袋”按钮确认。

此前完整 `35013b1` 运行覆盖两单全部1348.249s、80735活跃帧，59.881FPS，p95 17.7ms、p99 24ms，超过50ms为9帧。该版本包含相同车辆、道路与音乐实现，后续提交修正招牌图集和不可达距离文案。两个版本的记录在结构化数据中分别标出。

## 路口、擦边和倒车

以下为当前版本正常输入产生的实际坐标。路缘拒绝对应车身接触可见车道边界，使用倒车与调整方向继续行驶。专项测试包含有意的提前转弯与擦边，相关停顿计入订单计时。

| 地点 | 现场结果 | 版本与画面 |
| --- | --- | --- |
| Union / Roosevelt | 完成右转，对线后继续西行 | `35013b1` [路口](flushing-union-turn.png)，最终版在两次法拉盛运行中重复通过 |
| Main / Roosevelt公交交界 | 从x13.24、z-2.90西行越过Main，沿合法Roosevelt支路继续到Prince | `51cb5fc`坐标记录，[阶段前](flushing-main-seam-before.png) / [阶段后](flushing-main-seam-after.png)对应 `35013b1` |
| Prince / Roosevelt及Prince / 38th | 完成转弯，接触路缘后倒车修正，继续到取送地点 | [Prince](flushing-prince-turn.png) / [38th](flushing-38th-turn.png)为 `35013b1`，最终版重复完成 |
| Main / 38th公交交界 | -53.20/-134.13驶至-48.04/-136.79，在后续折角车身接触路缘，倒车3.15m至-50.93/-135.54 | `51cb5fc` [接缝与接触位置](release-flushing-main38-forward.png) |
| Main / 39th公交交界 | 从-37.06/-74.21，通过折线连接到-10.16/-71.46，再倒车3.21m至-13.32/-70.91 | `51cb5fc` [前](release-flushing-main39-before.png) / [后](release-flushing-main39-after.png)，专项在两单后单独完成，DPR2 |
| Worth / Bayard、Bayard / Bowery | 路缘接触后倒车，修正起转位置后合法通过 | `35013b1` [Bayard / Bowery](chinatown-bayard-bowery.png)，`51cb5fc`坐标记录包含重试和通过位置 |
| Bowery / Pell、Pell / Mott | 加宽Pell转角可通过，Mott起转过晚时倒车重新对线继续行驶 | `35013b1` [Pell](chinatown-pell-turn.png)，`51cb5fc`最终Pell余量1.67m、Mott重试后2.26m |
| Doyers步行边界 | 汽车向广场起转时被边界阻止，倒车后沿Pell/Mott合法绕行，步行可进入取餐 | `35013b1` [拒绝原因restricted](chinatown-doyers-car-boundary.png) / [步行](chinatown-doyers-foot-boundary.png)，`51cb5fc` [边界](release-chinatown-doyers-restricted.png)及最终送单再次覆盖 |

现场上述交界未观察到异色共面闪烁，路面三角面与建筑排除另有几何回归。各地点原版的同位置道路特写尚未全部补齐，旧版出生点、八方向与两店同机位截图已保存。

## 控制模型对照

下表固定车速持续满转向，半径由90°过程轨迹估算。输入速率和转角变化共同影响结果。

| 固定车速 | 90°用时前 / 后 | 估算半径前 / 后 |
| --- | --- | --- |
| 3.0m/s | 2.242 / 1.817s | 4.278 / 3.458m |
| 4.5m/s | 2.133 / 1.242s | 6.102 / 3.539m |
| 6.7m/s，约15mph | 3.092 / 1.833s | 13.156 / 7.816m |
| 9.0m/s，约20mph | 4.092 / 3.325s | 23.413 / 19.005m |

另选两区各四个真实路口，固定3m/s、4.5m进场距离进行纯模块姿态对照。八处前后均完成90°，受阻帧比例均为0，单次样本无法据此判断真实手机碰撞率下降。控制模型与实际键鼠送单记录的适用范围分别写入结构化数据。

## 远景、街面与资源对照

相同设备、出生驾驶位、1512×777、DPR1、标准档，各32个密集F3样本。基线 `dc44b36` 对照 `35013b1`，后续图集修正保持相同场景体量。

| 指标 | 之前 | 道路与远景修复后 |
| --- | --- | --- |
| Draw Calls最小 / 均值 / 最大 | 506 / 574.5 / 643 | 488 / 555.5 / 632 |
| 三角面最小 / 均值 / 最大 | 290879 / 300839.5 / 310800 | 305305 / 320674.8 / 338094 |
| 静止活跃帧平均FPS | 59.928，24.28s | 60.004，8.48s |
| p95 / p99 | 17.6 / 17.8ms | 17.5 / 25.0ms |
| 首页HUD / 场景就绪 | 6882 / 8630ms | 3351 / 3692ms |

镜面隔帧更新会改变单帧计数。新增城市与路缘增加三角面。浏览器已运行，缓存与首次着色器状态不同，首页时长记录不能用于推断整机冷启动改善。

同DPR1的八方向资源读数还覆盖两区。法拉盛平均Draws480.75→478.63，三角面282149→299029，纹理46.3MiB→47.1MiB，近车镜面帧曾到83.2MiB。唐人街平均Draws428.75→456.00，三角面300023→311626，纹理47.1→47.8MiB。该组为短时朝向观察，完整帧统计见送单记录。

最终 `51cb5fc` 的两区两档32张远景截图采用恢复后的默认DPR2，视口仍为1512×777。与旧版DPR1图可核对空间机位和背景填充。性能数值使用上述独立DPR1对照。

### 远景截图

| 区域 | 旧版dc44b36 | 最终标准51cb5fc | 最终低档51cb5fc |
| --- | --- | --- | --- |
| 法拉盛 | [0](before-flushing-view-0.png) [1](before-flushing-view-1.png) [2](before-flushing-view-2.png) [3](before-flushing-view-3.png) [4](before-flushing-view-4.png) [5](before-flushing-view-5.png) [6](before-flushing-view-6.png) [7](before-flushing-view-7.png) | [0](after-flushing-view-0.png) [1](after-flushing-view-1.png) [2](after-flushing-view-2.png) [3](after-flushing-view-3.png) [4](after-flushing-view-4.png) [5](after-flushing-view-5.png) [6](after-flushing-view-6.png) [7](after-flushing-view-7.png) | [0](after-flushing-low-view-0.png) [1](after-flushing-low-view-1.png) [2](after-flushing-low-view-2.png) [3](after-flushing-low-view-3.png) [4](after-flushing-low-view-4.png) [5](after-flushing-low-view-5.png) [6](after-flushing-low-view-6.png) [7](after-flushing-low-view-7.png) |
| 唐人街 | [0](before-chinatown-view-0.png) [1](before-chinatown-view-1.png) [2](before-chinatown-view-2.png) [3](before-chinatown-view-3.png) [4](before-chinatown-view-4.png) [5](before-chinatown-view-5.png) [6](before-chinatown-view-6.png) [7](before-chinatown-view-7.png) | [0](after-chinatown-view-0.png) [1](after-chinatown-view-1.png) [2](after-chinatown-view-2.png) [3](after-chinatown-view-3.png) [4](after-chinatown-view-4.png) [5](after-chinatown-view-5.png) [6](after-chinatown-view-6.png) [7](after-chinatown-view-7.png) | [0](after-chinatown-low-view-0.png) [1](after-chinatown-low-view-1.png) [2](after-chinatown-low-view-2.png) [3](after-chinatown-low-view-3.png) [4](after-chinatown-low-view-4.png) [5](after-chinatown-low-view-5.png) [6](after-chinatown-low-view-6.png) [7](after-chinatown-low-view-7.png) |

法拉盛车外机位282.71/-157.71，起始yaw-158.3°。唐人街248.49/133.85，起始yaw96.2°。每张向右转约45°。车内另有 [法拉盛前](before-flushing-cockpit.png) / [后](after-flushing-cockpit.png)，[唐人街前](before-chinatown-cockpit.png) / [后](after-chinatown-cockpit.png)。

### 两店同机位

| 地点 | 旧版dc44b36 | 最终51cb5fc | 坐标、视角与资源 |
| --- | --- | --- | --- |
| 槐香面馆街外 | [前](before-flushing-noodle-front.png) | [后](after-flushing-noodle-front.png) | 前-169.68/25.47，后-169.71/25.48，yaw-65.8°，DPR1 |
| 珍巷面馆街角 | [前](before-chinatown-noodle-front.png) | [后](after-chinatown-noodle-front.png) | 前-7.01/30.27，后-7.02/30.25，yaw85.5°，DPR1 |

前后位置误差小于0.05m、等效朝向误差小于0.2°。帧内Draws受镜面与近景更新阶段影响，具体现场读数在结构化数据的frontages字段。基线TapTap ZIP 9,899,992字节，最终9,980,431字节，增加80,439字节，约0.81%。

`stage-b-flushing-cockpit.png` 对应 `d810619`。无release前缀的柜台、接缝和结算图对应 `35013b1`。其中 `chinatown-noodle-front.png`、`flushing-noodle-front.png` 保留图集问题发现时的画面，最终正确图为上述after两店图。

## 音乐和触屏

[电台横屏](music-radio-landscape.png) · [本地歌曲横屏](music-local-landscape.png) · [外部音乐横屏](music-external-landscape.png) · [驾驶横屏](release-driving-landscape.png) · [驾驶竖屏](release-driving-portrait.png)，均为最终 `51cb5fc`，桌面浏览器设定相应视口，DPR1。

三个来源页主体横向溢出均为0。外部页无内置播放/上一首/下一首，主按钮应用声音方案，返回后暂停菜单仍显示且paused=true。外部来源采用明确的手动系统App切换引导。尚未取得经核验并实测的TapTap外部音乐App直达能力。

本地导入与取消的本轮实际自动化被浏览器扩展的本地文件读取权限阻止，真实文件导入结果仍待复核。现有歌单与异步音频回归均通过，历史文件播放证据保留原版本记录。

## TapTap自测交付

最终文件 `NY-delivery-51cb5fc-H5.zip`，9,980,431字节，154个文件，入口game/index.html，构建戳dirty=false。上传前本地检查无违规项与警告，上传成功后从H5包体列表读回同名、同大小记录，再生成对应自测二维码PNG。

SHA256为 `8924840012dd22628c890482a5e1e32569df751ad693826bf444c204398b94b0`。二维码随当前开发对话以图片交付。上传保留在游戏测试草稿的包体库，PR保持Draft。

## 实体手机未测项

- Mate 60 Pro新包首次加载、系统版本、TapTap版本与实际容器。
- 双指摇杆或油门加观察，手指移出、系统取消、横竖屏切换后的输入释放。
- 真机刘海、安全区、字体与控件可达性。
- 手机本地文件多选、取消、追加、替换、刷新后重选。
- 外部音乐先启动后进游戏，以及先游戏后切出播放再返回两种顺序。
- 外部音乐与提示/环境音共存、全静音替代流程、锁屏及后台恢复。
- 连续15分钟FPS、掉帧、发热、耗电与系统音频实际输出。

实体手机测试可直接使用对话中的最终TapTap二维码，菜单版本应为51cb5fc。
