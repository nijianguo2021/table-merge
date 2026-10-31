# 合表小助手

手机与电脑浏览器内批量处理 Excel、CSV、TSV 和表格图片，核对后合并、去重并下载 XLSX。

所有用户文件仅在访问者自己的浏览器内处理，不上传表格内容。图片识别首次需要下载模型。

## GitHub Pages

将本目录文件作为公开仓库的根目录。进入 Settings → Pages，选择 Deploy from a branch，然后选择 main / (root)。

本项目无需编译或服务端配置。入口文件为 index.html；.nojekyll 用于直接发布静态文件。

## 第三方组件

SheetJS CE 0.20.3、Tesseract.js 6.0.1、Tesseract.js-core 6.0.0 及 Tesseract 语言数据。第三方文件保留原有版权信息，遵循各自许可证。
