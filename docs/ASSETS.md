# 资源来源与使用条件

## 自制内容

- Review 5923195143新增12组原创虚构品牌，由DistrictPresentation.ts的STREET_BRANDS与World.ts的Canvas图形生成。1024×512共享图集包含碗、蒸汽、叶片、花、篮筐、洗衣与杯形符号及店名，另有营业时间和街坊提示。几何背景、固定种子街面细节与图集沿用本项目自制内容的使用、修改与分发条件，源代码和生成图形可随项目分发。
- 当前街道与建筑壳体由 NYC 官方数据离线转换，World.ts 加载按街块分组的 glTF，并生成原创柜台、人物、餐袋与入口细节。CarModel.ts 生成自制轿车车身、圆形车轮、车厢、方向盘、仪表和中控。ModelGeometry.ts 复用网格、材质，并按材质合并静态几何，Person.ts 的动态头、肩、腿分别保留独立节点。比例单位为米，固定傍晚配色。自制几何与配色可在本项目及衍生作品中使用、修改与分发。
- 招牌、砖墙窗框、仪表、导航与天空渐变由浏览器 Canvas 绘制。仪表与导航读取真实车辆和订单状态，后视镜使用当前场景的 RenderTexture 摄像机。餐厅品牌、顾客及订单为原创内容。街名与建筑轮廓采用真实数据，取送入口布置和停车标记为游戏设定。
- 仪表台、方向盘、座椅、车门、车身及近景车辆采用自制圆角网格与连续边缘法线。皮纹和拉丝纹理由确定性 Canvas 像素生成，玻璃使用引擎透明材质。车轮按车速转动，方向盘绕倾斜转向柱旋转。几何按部件合并后随各自父节点运动。
- Evening on Orchard 是本轮编写 scripts/generate-music.py 生成的原创合成演示音乐，96 秒循环，MP3 96 kbps。和弦、旋律与音色均由脚本生成。该曲及生成脚本中的音乐素材按 CC0-1.0 提供，可公开分发与修改。来源为本仓库，使用条件见 [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/)。
- 交互提示音为 MusicPlayer.ts 中实时合成的短正弦音，同样按 CC0-1.0 提供。
- 玩家选取的本地文件通过 File 与 blob URL 在浏览器内播放。程序无上传流程，文件不加入工程资源和 Git。

## 字体

- DM Sans，版权属于 The DM Sans Project Authors，SIL Open Font License 1.1。原字体未修改，随工程保存原许可证。来源为 [Google Fonts DM Sans](https://github.com/google/fonts/tree/main/ofl/dmsans)。
- Instrument Serif，版权属于 The Instrument Serif Project Authors，SIL Open Font License 1.1。原字体未修改，随工程保存原许可证。来源为 [Google Fonts Instrument Serif](https://github.com/google/fonts/tree/main/ofl/instrumentserif)。
- NYDistrictSans 是 Noto Sans SC 的中文子集，修改字体家族名称并保留 Adobe 2014–2021 原版权及 OFL 1.1 全文。Canvas 店招等待字体加载完成后绘制。文件与许可保存于 game/assets/resources/fonts，SHA-256为 `4b0ae3ddab545739f944afd489c6122ad3353ac87f8612cc59db9f1843f9838a`，184840字节。2026-11-15取得上游字体，来源见 [Google Fonts Noto Sans SC](https://github.com/google/fonts/tree/main/ofl/notosanssc)。
- DM Sans 与 Instrument Serif 的许可证保存在 docs/licenses。HUD 中文保留系统字体回退。

## 地理数据与修改

| 提供者与数据 | 版本与使用条件 | 项目处理 |
| --- | --- | --- |
| NYC Street Centerline / Building Footprints | 2026-11-15官方服务裁片快照，保留NYC开放数据条款、来源和校验 | 坐标转米、端点拓扑、地面路段筛选、建筑简化glTF |
| MTA Subway Entrances and Exits 2024 | 2024入口数据，MTA / OPEN-NY提供者条款 | 法拉盛选定范围内四个楼梯入口位置 |
| MTA Bus Stops | 2026-11-15查询in_effect=true，快照有效期2026-10-15至2027-01-02 | 每区选取最多四个真实站点标记 |
| ArcGIS Geometry Service | 仅在开发转换期间投影坐标 | WGS84点投影到EPSG2263，再转本地米制 |

准确查询URL、获取UTC时间、裁片与SHA-256保存于 [Flushing来源记录](maps/flushing-source.json)和[Chinatown来源记录](maps/chinatown-source.json)。运行时只加载仓库内裁片与生成资产。地面平坦化、庭院孔洞省略、楼高夹取4.5—96米、缺失楼高回退12米均由转换脚本明确记录。街道公交限行和步行访问采用说明过的简化规则。临时停车位尚未核实全部实地标牌。

NYC来源依据[元数据](https://github.com/CityOfNewYork/nyc-geo-metadata)与[开放数据适用条款](https://cityofnewyork.github.io/opendatatsm/publicpolicies.html)。MTA来源依据[地铁入口](https://data.ny.gov/Transportation/MTA-Subway-Entrances-and-Exits-2024/i9wp-a4ja/about_data)、[公交站](https://data.ny.gov/Transportation/MTA-Bus-Stops/2ucp-7wg5/about_data)、[MTA开放数据](https://www.mta.info/open-data)与[OPEN-NY条款](https://data.ny.gov/dataset/OPEN-NY-Terms-Of-Use/77gx-ii52)。各提供者条款随来源记录保留。

立面、消防梯、店内布局、取餐架和街具由本项目生成，共享材质与店招缓存。当前使用官方轮廓生成的glTF壳体，外部城市模型包未纳入工程。转换、导入与修改细节见[地图说明](maps/README.md)。

## 引擎与模板

工程 tsconfig、忽略规则和场景序列化基础参考安装包自带的 empty 与 hello-3d-world 正式模板。场景通过 Creator 3.8.8 实际导入与构建。模板中的示例模型、贴图与天空盒未复制到本项目。

材质引用当前引擎自带 builtin-standard 和 builtin-unlit，几何 API 为 Cocos primitives。引擎内置资源遵循 Cocos 自身的许可与发布条款。工程保留默认 Cocos 启动画面。

## 视觉参考

2026-11-14 复查该页面的 12 张公开截图，第 5、8、10 张展示右侧油门、刹车、D/R 档位与顶部工具栏。本项目据此采用独立踏板、档位和折叠工具栏。步行双区操作由本项目实现，参考素材保存于本机 .local/reference。参考页面为 [TapTap 游戏详情](https://www.taptap.cn/app/995770?os=android)。

用户指定《网约车：接单人生》的公开截图，用于参考驾驶舱层次、仪表与导航布局、街景纵深。本项目的几何、界面与贴图由上述模块自制。参考页面为 [TapTap 游戏详情](https://www.taptap.cn/app/995770?os=android)。

## 运行证据

docs/media 保存 Cocos 发布构建及编辑器预览的实机截图。上一轮完整170秒有声送单视频为 docs/media/review-20261115/ordinary-delivery.mp4，只使用下表两首原创曲目与项目合成声音，随该目录保存拍摄条件、代码SHA和文件校验值。原始录屏保留在本机 .local/media，声音轨检查结果见 VALIDATION.md。本轮两区视频位于docs/media/maps-20261115，使用ScreenCaptureKit连续录制实际游戏窗口和应用音轨，包含上述两首原创CC0曲目与游戏合成声音，采集方式与校验保存于媒体索引。

## Review 默认音乐权利记录

两首音乐均为本项目编写的确定性合成作品，未使用外部录音、采样或歌曲旋律。以下 CC0 声明覆盖本项目原创音乐与录音，保留的第三方字体和引擎各自遵循原许可。完整文本保存于 `docs/licenses/CC0-1.0.txt`。

| 曲名 | 作者 / 权利来源 | 来源 URL | 许可版本 | 必要署名 | 修改 | 适用范围 |
| --- | --- | --- | --- | --- | --- | --- |
| Evening on Orchard | NY-delivery 项目原创合成 | [生成脚本](https://github.com/sy0310/NY-delivery/blob/codex/bootstrap-delivery-demo/scripts/generate-music.py) | CC0 1.0 Universal | 无强制署名，可标注本项目 | 本轮生成脚本重构，音频 SHA-256 核对保持一致 | 可随游戏分发、修改、公开宣传录屏与直播使用 |
| River Lights | NY-delivery 项目原创合成 | [生成脚本](https://github.com/sy0310/NY-delivery/blob/codex/bootstrap-delivery-demo/scripts/generate-music.py) | CC0 1.0 Universal | 无强制署名，可标注本项目 | 本轮新增，120 秒，64 BPM，无人声 | 可随游戏分发、修改、公开宣传录屏与直播使用 |
| 游戏交互提示与环境声 | MusicPlayer.ts 实时合成 | [合成代码](https://github.com/sy0310/NY-delivery/blob/codex/bootstrap-delivery-demo/game/assets/scripts/MusicPlayer.ts) | CC0 1.0 Universal | 无强制署名 | 本轮缩短提示、独立混音 | 游戏分发与宣传视频 |

录屏用音乐模式仅允许以上可用电台音乐或内部静音，隐藏本地文件名。本地选歌的权利由所选曲目的真实许可决定，录屏开关仅控制游戏自身音轨。外部音乐 App 与系统录音仍由设备和录屏工具控制。
