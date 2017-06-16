# Camera
A web camera build with HTML and JS

## 使用方法
```javascript
// 实例化
var camera = new Camera({
  imageType: 'png',
  needEdit: false,
  width: 600,
  height: 400
});
// 初始化
camera.init();
// 获取Img标签
var image = camera.take();
```


## 配置项
| 配置名         | 说明       | 默认值  |
| ------------- | ------------- | ----- |
| needEdit      | 是否需要选择图片区域 | false |
| imageType      | 图片类型可选png、jpeg  |   png |
| width | 视频展示区域宽度      |    600 |
| height | 视频展示区域高度      |    400 |
