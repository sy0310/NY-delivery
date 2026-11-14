# 资源来源与使用条件

## 自制内容

- World.ts 生成街道、建筑、柜台、人物、餐袋与门口。CarModel.ts 生成自制轿车车身、圆形车轮、车厢、方向盘、仪表和中控。ModelGeometry.ts 复用网格、材质，并按材质合并静态几何。比例单位为米，固定傍晚配色。自制几何与配色可在本项目及衍生作品中使用、修改与分发。
- 招牌、砖墙窗框、仪表、导航与天空渐变由浏览器 Canvas 绘制。仪表与导航读取真实车辆和订单状态，后视镜使用当前场景的 RenderTexture 摄像机。餐厅、顾客、地址及订单为虚构内容。
- Evening on Orchard 是本轮编写 scripts/generate-music.py 生成的原创合成演示音乐，96 秒循环，MP3 96 kbps。和弦、旋律与音色均由脚本生成。该曲及生成脚本中的音乐素材按 CC0-1.0 提供，可公开分发与修改。来源为本仓库，使用条件见 [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/)。
- 交互提示音为 MusicPlayer.ts 中实时合成的短正弦音，同样按 CC0-1.0 提供。
- 玩家选取的本地文件通过 File 与 blob URL 在浏览器内播放。程序无上传流程，文件不加入工程资源和 Git。

## 字体

- DM Sans，版权属于 The DM Sans Project Authors，SIL Open Font License 1.1。原字体未修改，随工程保存原许可证。来源为 [Google Fonts DM Sans](https://github.com/google/fonts/tree/main/ofl/dmsans)。
- Instrument Serif，版权属于 The Instrument Serif Project Authors，SIL Open Font License 1.1。原字体未修改，随工程保存原许可证。来源为 [Google Fonts Instrument Serif](https://github.com/google/fonts/tree/main/ofl/instrumentserif)。
- 许可证保存于 docs/licenses。中文文字使用浏览器的系统字体回退。

## 引擎与模板

工程 tsconfig、忽略规则和场景序列化基础参考安装包自带的 empty 与 hello-3d-world 正式模板。场景通过 Creator 3.8.8 实际导入与构建。模板中的示例模型、贴图与天空盒未复制到本项目。

材质引用当前引擎自带 builtin-standard 和 builtin-unlit，几何 API 为 Cocos primitives。引擎内置资源遵循 Cocos 自身的许可与发布条款。工程保留默认 Cocos 启动画面。

## 视觉参考

用户指定《网约车：接单人生》的公开截图，用于参考驾驶舱层次、仪表与导航布局、街景纵深。本项目的几何、界面与贴图由上述模块自制。参考页面为 [TapTap 游戏详情](https://www.taptap.cn/app/995770?os=android)。

## 运行证据

docs/media 保存 Cocos 发布构建及编辑器预览的实机截图。录屏保留在本机 .local/media，完成情况与声音轨检查结果见 VALIDATION.md。
