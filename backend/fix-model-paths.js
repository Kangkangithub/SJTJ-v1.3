const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

// 数据库修复脚本
const db = new Database('./data/military-knowledge.db');

console.log('开始修复3D模型文件路径...');

try {
    // 获取所有模型记录
    const models = db.prepare('SELECT * FROM weapon_models').all();
    console.log(`找到 ${models.length} 个模型记录`);

    for (const model of models) {
        console.log(`\n处理模型 ID: ${model.id}, 文件: ${model.filename}`);
        console.log(`原始路径: ${model.file_path}`);

        // 构建期望的文件路径
        const expectedPath = path.join('uploads', 'weapons', 'models', model.filename);
        const fullPath = path.join(__dirname, expectedPath);
        
        console.log(`期望路径: ${expectedPath}`);
        console.log(`完整路径: ${fullPath}`);

        // 检查文件是否存在
        if (fs.existsSync(fullPath)) {
            console.log('✅ 文件存在');
            
            // 更新数据库中的路径（使用正斜杠）
            const normalizedPath = expectedPath.replace(/\\/g, '/');
            
            if (model.file_path !== normalizedPath) {
                db.prepare('UPDATE weapon_models SET file_path = ? WHERE id = ?')
                  .run(normalizedPath, model.id);
                console.log(`✅ 路径已更新为: ${normalizedPath}`);
            } else {
                console.log('✅ 路径已正确');
            }
        } else {
            console.log('❌ 文件不存在');
            
            // 尝试在其他位置查找文件
            const searchPaths = [
                path.join(__dirname, 'uploads', 'weapons', 'models', model.filename),
                path.join(__dirname, '..', 'uploads', 'weapons', 'models', model.filename),
                path.join(__dirname, model.file_path.replace(/\\/g, '/')),
                path.join(__dirname, '..', model.file_path.replace(/\\/g, '/'))
            ];

            let found = false;
            for (const searchPath of searchPaths) {
                if (fs.existsSync(searchPath)) {
                    console.log(`✅ 在 ${searchPath} 找到文件`);
                    
                    // 移动文件到正确位置
                    const targetDir = path.dirname(fullPath);
                    if (!fs.existsSync(targetDir)) {
                        fs.mkdirSync(targetDir, { recursive: true });
                    }
                    
                    fs.copyFileSync(searchPath, fullPath);
                    console.log(`✅ 文件已复制到正确位置`);
                    
                    // 更新数据库路径
                    const normalizedPath = expectedPath.replace(/\\/g, '/');
                    db.prepare('UPDATE weapon_models SET file_path = ? WHERE id = ?')
                      .run(normalizedPath, model.id);
                    console.log(`✅ 数据库路径已更新`);
                    
                    found = true;
                    break;
                }
            }
            
            if (!found) {
                console.log('❌ 在所有位置都未找到文件，建议删除此记录或重新上传文件');
                
                // 可选：删除无效记录
                // db.prepare('DELETE FROM weapon_models WHERE id = ?').run(model.id);
                // console.log('❌ 已删除无效记录');
            }
        }
    }

    console.log('\n修复完成！');

} catch (error) {
    console.error('修复过程中出错:', error);
} finally {
    db.close();
}