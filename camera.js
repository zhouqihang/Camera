// 获取相机容器，创建video节点
// 创建canvas标签节点，初始化拍照按钮
// 根据配置参数决定是否创建图片容器节点

(function (window) {
    /**
     * 相机构造函数
     * @param {string} id ID名称
     * @param {object} config 配置参数
     * @param {string} [config.imageType] 输出图片格式
     * @param {boolean} [config.needEdit] 配置参数
     * @param {number} [config.width] 长度
     * @param {number} [config.height] 高度
     * @constructor
     */
    var Camera = function (id, config) {
        this.idNode = document.getElementById(id) || document.body;
        this.config = Object.assign({
            imageType: 'png',     // 图片格式，仅在设置了needImage时可用 indexOf
            needEdit: false,      // 是否需要编辑照片
            width: 600,           // 可视区域长度
            height: 400           // 可视区域宽度
        }, config);
        // 裁剪区域坐标信息
        this.edit = {
            x: 0,
            y: 0,
            w: 0,
            h: 0
        };
    };
    var fn = Camera.prototype;


    /**
     * 初始化方法，生成video、拍照按钮、闪光灯模板
     * 根据参数决定是否需要生成编辑页面
     */
    fn.init = function () {
        setStyle(this.idNode, 'position', 'relative');
        setStyle(this.idNode, 'overflow', 'hidden');

        // 创建节点 video
        this._video = createVideoNode(this.idNode);

        // 如果需要裁剪图片，为Video绑定事件 并创建裁剪框
        if (this.config.needEdit) {
            editEvent(this);
            this.clipRect = new ClipRect({});
            this.clipRect.init();
            this.idNode.appendChild(this.clipRect.rect);
        }

        // 开启相机
        this.startCamera(this._video, this.config.width, this.config.height);
    };

    /**
     * 开启相机
     * @param {Node} video
     * @param {number} videoWidth
     * @param {node} videoHeight
     */
    fn.startCamera = function (video, videoWidth, videoHeight) {
        // 老式的浏览器可能不会实现mediaDevices, 所以我们先将他设置为一个空的对象
        if (navigator.mediaDevices === undefined) {
            navigator.mediaDevices = {};
        }

        if (navigator.mediaDevices.getUserMedia === undefined) {
            navigator.mediaDevices.getUserMedia = promisifiedOldGUM;
        }

        // 参数设置
        var constraints = {
            audio: false,   // 不启用音频设备
            video: {
                width: videoWidth,
                height: videoHeight
            }
        };

        navigator.mediaDevices.getUserMedia(constraints)
            .then(function (stream) {
                video.src = window.URL.createObjectURL(stream);
                video.onloadedmetadata = function (e) {
                    video.play();
                };
            })
            .catch(function (err) {
                console.log(err.name + ": " + err.message);
            });
    };

    /**
     * 拍摄照片
     * @return {Node} Img
     */
    fn.take = function () {
        if (!checkImageType) {
            return false;
        }

        // 创建canvas节点
        var canvas = null, ctx = null;
        if (this.edit.w == 0 || this.edit.h == 0) {
            // 全尺寸
            canvas = createCanvasNode(this.config.width, this.config.height);
            ctx = canvas.getContext('2d');
            ctx.drawImage(this._video, this._video.width, this._video.height);
        } else {
            // 裁剪尺寸
            canvas = createCanvasNode(this.edit.w, this.edit.h);
            ctx = canvas.getContext('2d');
            ctx.drawImage(this._video, this.edit.x, this.edit.y, this.edit.w, this.edit.h, 0, 0, this.edit.w, this.edit.h);
        }

        var image = new Image();
        image.src = canvas.toDataURL('image/' + this.config.imageType.toLowerCase());
        return image;
    };

    /**
     * 需要裁剪图片，为video添加事件绑定
     * @param objectCamera
     */
    var editEvent = function (objectCamera) {
        var offset = getOffset(objectCamera._video);
        var offsetX = offset.offsetX,   // 距离文档顶部距离
            offsetY = offset.offsetY;   // 距离文档底部的距离
        var startX = 0, // 开始点
            startY = 0; // 开始点
        // 裁剪矩形坐标信息
        var rectPoint = {x: 0, y: 0, h:0, w: 0};
        var hasMoved = false;       // 记录鼠标是否发生过移动


        // 鼠标按下监听
        objectCamera._video.addEventListener('mousedown', function (e) {
            startX = e.clientX - (offsetX - document.body.scrollLeft);   // 起点X
            startY = e.clientY - (offsetY - document.body.scrollTop);    // 起点Y

            // 隐藏裁剪区域 重置参数
            objectCamera.clipRect.hide();
            rectPoint.x = startX;
            rectPoint.y = startY;
            hasMoved = false;

            // 鼠标移动监听
            objectCamera.idNode.addEventListener('mousemove', mouseMove);
        });
        // 鼠标抬起时
        document.addEventListener('mouseup', function () {
            objectCamera.idNode.removeEventListener('mousemove', mouseMove);
            objectCamera.edit = hasMoved ? rectPoint : {x: 0, y: 0, w: 0, h: 0};
        });

        // 鼠标移动
        var mouseMove = function (e) {
            hasMoved = true;
            // 计算裁剪框的长度和高度
            var w = e.clientX - (offsetX - document.body.scrollLeft) - startX;   // 宽度
            var h = e.clientY - (offsetY - document.body.scrollTop) - startY;   // 高度
            rectPoint.w = w;
            rectPoint.h = h;
            if (w < 0) {
                rectPoint.w = -w;
                rectPoint.x = startX + w;
            }
            if (h < 0) {
                rectPoint.h = -h;
                rectPoint.y = startY + h;
            }

            // 绘制矩形框
            objectCamera.clipRect.refresh(rectPoint);
        };

    };


    /**
     * 计算元素距离文档上下边界的距离
     * @param {Node} target
     * @return {Object}
     */
    var getOffset = function (target) {
        var offsetX = 0,          // 距离文档左侧的距离
            offsetY = 0,          // 距离文档右侧的距离
            offsetTarget = null;  // 当前计算目标

        for (offsetTarget = target; offsetTarget != null; offsetTarget = offsetTarget.offsetParent) {
            offsetX += offsetTarget.offsetLeft;
            offsetY += offsetTarget.offsetTop;
        }
        return {offsetX: offsetX, offsetY: offsetY};
    };

    /**
     * 创建video节点
     * @param {Node} node
     * @return {Node}
     */
    var createVideoNode = function (node) {
        var video = document.createElement('video');
        setStyle(video, 'position', 'relative');
        setStyle(video, 'verticalAlign', 'top');
        node.appendChild(video);
        return video;
    };

    /**
     * 获取 getUserMedia Promise对象
     * @return {Promise}
     */
    var apromisifiedOldGUM = function () {
        // 获取userMedia对象
        var getUserMedia = navigator.getUserMedia ||
            navigator.webkitGetUserMedia ||
            navigator.mozGetUserMedia;
        // 浏览器支持，设置为空对象
        if (!getUserMedia) {
            return Promise(new Error('你的浏览器不能调用摄像头'));
        }

        // 浏览器支持调取摄像头，使用Promise
        return new Promise(function (resolve, reject) {
            getUserMedia.call(navigator, resolve, reject);
        });
    };

    /**
     * 创建canvas节点
     * @param {number} width
     * @param {number} height
     * @param {Node}
     */
    var createCanvasNode = function (width, height) {
        var canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        return canvas;
    };

    /**
     * 设置元素style
     * @param {Node} ele
     * @param {string} styleName
     * @param {string} value
     */
    var setStyle = function (ele, styleName, value) {
        ele.style[styleName] = value;
    };

    /**
     * 检查图片是否是指定样式
     * @param {string} type
     * @return {boolean}
     */
    var checkImageType = function (type) {
        return ['png', 'jpeg'].indexOf(type.toLowerCase()) === -1;
    };


    /**
     * 裁剪框矩形类
     * @param config
     * @constructor
     */
    function ClipRect(config) {
        this.point = {x: 0, y: 0, w: 0, h: 0};
        this.borderColor = config.borderColor || '#000';            // 边框颜色
        this.color = config.color || 'rgba(255, 255, 255, 0.7)';    // 填充颜色
        this.rect = document.createElement('div');

        /**
         * 获取一个矩形区域
         */
        this.init = function () {
            var div = this.rect;
            setStyle(div, 'position', 'absolute');  // 绝对定位
            setStyle(div, 'top', this.point.y + 'px');    // top
            setStyle(div, 'left', this.point.x + 'px');   // left
            setStyle(div, 'width', this.point.w + 'px');  // width
            setStyle(div, 'height', this.point.h + 'px'); // height
            setStyle(div, 'backgroundColor', this.color);           // 背景色
            setStyle(div, 'border', '1px solid ' + this.border);    // 边框
            setStyle(div, 'cursor', 'move');    // 边框
            this.hide();
            this.addMoveEvent();
        };

        /**
         * 刷新矩形位置
         * @param {object} point
         */
        this.refresh = function (point) {
            var div = this.rect;
            setStyle(div, 'top', point.y + 'px');    // top
            setStyle(div, 'left', point.x + 'px');   // left
            setStyle(div, 'width', point.w + 'px');  // width
            setStyle(div, 'height', point.h + 'px'); // height
            this.show();
            this.point = point;
        };

        /**
         * 隐藏
         */
        this.hide = function () {
            setStyle(this.rect, 'display', 'none');
        };

        /**
         * 显示
         */
        this.show = function () {
            setStyle(this.rect, 'display', 'block');
        };

        /**
         * 闪动
         */
        this.flash = function () {
            this.hide();
            this.show();
        };

        /**
         * 鼠标点下
         */
        this.addMoveEvent = function () {
            var startX = 0,
                startY = 0;
            var self = this;
            var moveX = 0,
                moveY = 0;

            this.rect.addEventListener('mousedown', function (e) {
                startX = e.clientX;
                startY = e.clientY;
                this.addEventListener('mousemove', mouseMoveAction);
            });
            document.addEventListener('mouseup', function () {
                self.rect.removeEventListener('mousemove', mouseMoveAction);
            });

            var mouseMoveAction = function (e) {
                moveX = e.clientX - startX;
                moveY = e.clientY - startY;
                self.point.x += moveX;
                self.point.y += moveY;
                self.refresh(self.point);
                startX = e.clientX;
                startY = e.clientY;
                console.log(moveX, moveY);
            };
        };
    }


    window.Camera = Camera;
})(window);
