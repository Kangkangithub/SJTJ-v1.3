from flask import Flask, request, jsonify
from ultralytics import YOLO
from PIL import Image
import numpy as np
import io
import os
import uuid

app = Flask(__name__)

# 加载训练好的模型
model = YOLO('best.pt')

# 武器类别映射（根据你的训练数据集）
class_names = {
    0: "AK-47",
    1: "M16",
    2: "F-22",
    3: "Su-57",
    4: "J-20",
    5: "T-72"
}


@app.route('/api/recognize', methods=['POST'])
def recognize_weapon():
    # 检查是否有文件上传
    if 'file' not in request.files:
        return jsonify({'error': 'No file part'}), 400

    file = request.files['file']

    # 检查文件名是否为空
    if file.filename == '':
        return jsonify({'error': 'No selected file'}), 400

    try:
        # 读取图像
        image = Image.open(io.BytesIO(file.read()))

        # 转换为RGB（如果是RGBA）
        if image.mode != 'RGB':
            image = image.convert('RGB')

        # 执行YOLO检测
        results = model(image)

        # 处理检测结果
        detections = []
        for result in results:
            for box in result.boxes:
                # 只考虑置信度大于0.5的结果
                if box.conf.item() > 0.5:
                    detection = {
                        'class_id': int(box.cls.item()),
                        'class_name': class_names.get(int(box.cls.item()), "Unknown"),
                        'confidence': round(box.conf.item(), 2),
                        'bbox': box.xyxy.tolist()[0]  # [x1, y1, x2, y2]
                    }
                    detections.append(detection)

        # 如果没有检测到任何武器
        if not detections:
            return jsonify({'message': 'No weapon detected', 'detections': []})

        # 返回检测结果（按置信度排序）
        sorted_detections = sorted(detections, key=lambda x: x['confidence'], reverse=True)
        return jsonify({
            'success': True,
            'detections': sorted_detections,
            'primary_weapon': sorted_detections[0]  # 置信度最高的结果
        })

    except Exception as e:
        return jsonify({'error': str(e)}), 500


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)