# 制造商武器数量统计API修复说明

## 问题分析

原来的制造商武器数量统计功能无法从API获取数据的主要原因：

1. **数据库查询不完整**：武器API只查询了武器表，没有关联制造商表
2. **返回数据缺失**：API响应中没有包含制造商信息
3. **端口连接问题**：前端只尝试连接3001端口，但服务器可能运行在3000端口

## 修复内容

### 1. 后端API修复 (`backend/src/routes/weapons-simple.js`)

**修复前的查询：**
```sql
SELECT id, name, type, country, year, description FROM weapons
```

**修复后的查询：**
```sql
SELECT w.id, w.name, w.type, w.country, w.year, w.description, m.name as manufacturer
FROM weapons w
LEFT JOIN weapon_manufacturers wm ON w.id = wm.weapon_id
LEFT JOIN manufacturers m ON wm.manufacturer_id = m.id
```

**主要改进：**
- 添加了制造商表的LEFT JOIN查询
- 在API响应中包含了manufacturer字段
- 同时修复了获取所有武器和搜索武器的两个接口

### 2. 前端数据获取修复 (`scripts/knowledge-graph-analysis-manufacturer-complete.js`)

**主要改进：**
- 添加了多端口尝试连接机制（3000和3001端口）
- 增强了错误处理和日志记录
- 改进了数据解析逻辑
- 添加了详细的调试信息输出

## 测试步骤

### 1. 启动服务器
```bash
# 启动简化版服务器（推荐）
node start-simple-server.js

# 或者启动完整版服务器
node backend/src/app.js
```

### 2. 使用测试页面验证修复
打开 `test-manufacturer-api.html` 进行测试：

1. **测试API连接**：点击"测试API连接"按钮
2. **测试武器API**：点击"测试武器API"按钮
3. **测试制造商数据提取**：点击"测试制造商数据提取"按钮

### 3. 在知识图谱页面验证
1. 打开 `knowledge-graph.html`
2. 滚动到"知识图谱数据可视化分析"部分
3. 查看"制造商武器数量统计"图表
4. 点击图表右上角的刷新按钮测试数据更新

## 预期结果

修复后，制造商武器数量统计应该能够：

1. **成功连接API**：自动尝试3000和3001端口
2. **获取完整数据**：包含武器名称、类型、国家和制造商信息
3. **正确统计**：按制造商统计武器数量
4. **显示图表**：以柱状图形式展示前10个制造商的武器数量

## 调试信息

如果仍然遇到问题，请检查：

1. **浏览器控制台**：查看详细的调试日志
2. **服务器日志**：确认API请求是否到达服务器
3. **数据库内容**：确认数据库中有武器和制造商数据
4. **网络连接**：确认前端能够访问后端API

## 数据库结构说明

系统使用以下表结构存储数据：
- `weapons`：武器基本信息
- `manufacturers`：制造商信息
- `weapon_manufacturers`：武器和制造商的关联表

这种设计支持一个武器有多个制造商的情况，但当前API返回第一个关联的制造商。

## 后续优化建议

1. **支持多制造商**：修改API以支持返回武器的所有制造商
2. **缓存机制**：添加数据缓存以提高性能
3. **分页优化**：对大量数据进行分页处理
4. **错误重试**：添加自动重试机制