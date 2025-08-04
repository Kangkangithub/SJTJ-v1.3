# services/weapon_service.py
import random
import time

# 模拟武器识别服务（实际项目中应调用真实的 AI 模型）
def recognize_weapon(image_path):
    # 模拟处理时间
    time.sleep(1)
    
    # 模拟识别结果
    weapons = [
        {"name": "95式自动步枪", "confidence": random.uniform(0.7, 0.99), "type": "突击步枪"},
        {"name": "03式自动步枪", "confidence": random.uniform(0.7, 0.99), "type": "突击步枪"},
        {"name": "QBZ-191步枪", "confidence": random.uniform(0.7, 0.99), "type": "突击步枪"},
        {"name": "QSZ-92式手枪", "confidence": random.uniform(0.7, 0.99), "type": "手枪"},
        {"name": "88式狙击步枪", "confidence": random.uniform(0.7, 0.99), "type": "狙击步枪"}
    ]
    
    # 随机选择一个识别结果
    result = random.choice(weapons)
    
    return {
        "weapon_name": result["name"],
        "confidence": round(result["confidence"], 2),
        "weapon_type": result["type"],
        "description": f"{result['name']}是中国研制的一款{result['type']}，具有{result['confidence']*100:.0f}%的可能性是该武器。"
    }    