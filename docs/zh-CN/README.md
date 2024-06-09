<p align="center">
  <img alt="GCopy Logo" src="../gcopy.png" height="120" />
  <p align="center">Share your clipboard. Text, Screenshot, File are supported.</p>
</p>

---

[ENGLISH](../../README.md)

一个剪切板同步的工具, 支持`文字`、`截图`和`文件`.

使用 Golang 和 Nextjs 开发. 完全开源.

GCopy重视您的数据隐私, 不持久化存储您的数据, 它们都在内存中. 如果你24h内不使用, 数据就会被删除.

## 使用方法

![页面截图](../screenshot-chrome.png)

步骤:

1. 在两台设备A&B上使用浏览器打开网站[https://gcopy.rutron.net](https://gcopy.rutron.net), 使用相同的邮箱登录.
2. 在设备A上拷贝(比如`Ctrl+C`)之后按下页面右侧的按钮.
3. 切换到设备B再次按下该按钮, 数据完成同步. 去粘贴(`Ctrl+V`)吧!

## 背景

在日常的办公中, 我们通常需要操作两台以上的电脑, 尤其是软件开发工程师.

假如, 你需要同时操作Windows电脑和MacOS电脑, 在这两个设备之间传递信息变得非常麻烦. 
因为很多原因, 我找不到一个非常好的工具能共享两个不同操作系统的设备的剪切板.
当我拷贝了一段文字, 我需要在另外一台电脑上粘贴, 这通常非常困难.

现在的工具通常只支持文字, 但是截图, 文件不支持. 而且, 他们通常要求设备必须要在同一个局域网, 可以互相访问.
他们往往收费.

这很不好!

所以, 我开发了GCopy, 它解决了这些问题.
目前, 你可以在PC、Mac和移动端之间共享剪切板, 支持文字, 截图和文件.
它对网络没有太高的要求, 不同的设备可以在同一个局域网, 也可以不在.

最开始我使用Git作为后端存储, 使用powershell、osascript这样的脚本在不同的设备之间同步剪切板. 但是因为它依赖Git, 注定不能让更多的非技术朋友使用. 所以, 我使用Golang替换了Git, 来作为不同设备之间的数据中转服务, 但是它仍然需要您在设备上下载运行GCopy客户端, 给使用带来了门槛. 所以, 我做了现在的`GCopy v1.0`, 它是一个Web服务, 您可以直接打开网站[https://gcopy.rutron.net](https://gcopy.rutron.net)使用, 同时不用担心您的数据泄露.

## 浏览器兼容性

GCopy依赖浏览器的Clipboard API. 它的浏览器兼容性请参考: [browser_compatibility](https://developer.mozilla.org/en-US/docs/Web/API/Clipboard#browser_compatibility)

下面是测试过的浏览器和版本:

|浏览器|版本||
|-|-|-|
|Chrome for Windows|Version 123.0.6312.86 (Official Build) (x86_64)|✅ Tested|
|Edge for Windows 10|Version 124.0.2478.80 (Official build) (64-bit)|✅ Tested|
|Opera for Windows 10|Opera One(version: 109.0.5097.68)|✅ Tested|
|Chrome for macOS|Version 121.0.6167.85 (Official Build) (x86_64)|✅ Tested|
|Opera for macOS|Opera One(version: 109.0.5097.68)(x86_64)|✅ Tested|
|Safari|Version 15.6.1 (17613.3.9.1.16)|✅ Tested|
|Safari for iOS|Version 16.1|✅ Tested|
|Edge for HarmonyOS 3.0/4.0|Edge 122.0.2365.99|✅ Tested|
|Chrome for Android|107.0.5304.105|✅ Tested|
|Edge for Android|Edge 108.0.1462.48|✅ Tested|

## 不足之处

- 由于浏览器不支持在剪切板中读取和设置文件. 所以文件只能通过上传和下载的方式实现. 不过体验同样很丝滑.
- 同时只能同步一个文件.
- 因为服务器内存有限, 您同步的文件不能超过`--max-content-length`MB.

## 社区

欢迎你参与到GCopy中来, 不管你是用户还是贡献者,  
如果你有一些关于GCopy的问题需要支持, 可以通过下面的方式联系.

### 邮箱

这是我的个人邮箱: qustwwy@163.com, 你有什么问题, 可以给我写信.

### 微信

添加我的微信我拉你进群, 这里已经聚集了一帮有意思的朋友.

<img width="200" src="../wechat-lllaoj.png">

## 截图

Safari on iOS

<img width="300" alt="screenshot on ios safari" src="../screenshot-ios-safari.png">

## 更多

- [使用docker部署](./deploy-by-docker.md)
- [使用源代码部署](./deploy-from-source.md)