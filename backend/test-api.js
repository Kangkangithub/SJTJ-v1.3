const axios = require('axios');

const BASE_URL = 'http://localhost:3001/api';

async function testAPI() {
  console.log('🚀 开始测试兵智世界后端API...\n');

  try {
    // 1. 测试健康检查
    console.log('1. 测试健康检查...');
    const healthResponse = await axios.get('http://localhost:3001/health');
    console.log('✅ 健康检查通过:', healthResponse.data.message);
    console.log('   数据库类型:', healthResponse.data.database);
    console.log('   运行时间:', Math.floor(healthResponse.data.uptime), '秒\n');

    // 2. 测试API根路径
    console.log('2. 测试API根路径...');
    const apiResponse = await axios.get(BASE_URL);
    console.log('✅ API服务正常:', apiResponse.data.message);
    console.log('   版本:', apiResponse.data.version);
    console.log('   可用端点:', Object.keys(apiResponse.data.endpoints).join(', '), '\n');

    // 3. 测试用户注册
    console.log('3. 测试用户注册...');
    const registerData = {
      username: 'testuser',
      email: 'test@example.com',
      password: '123456',
      name: '测试用户'
    };
    
    try {
      const registerResponse = await axios.post(`${BASE_URL}/auth/register`, registerData);
      console.log('✅ 用户注册成功:', registerResponse.data.data.user.username);
      console.log('   用户ID:', registerResponse.data.data.user.id);
      console.log('   JWT令牌已生成\n');
      
      // 保存令牌用于后续测试
      const token = registerResponse.data.data.token;
      
      // 4. 测试用户登录
      console.log('4. 测试用户登录...');
      const loginData = {
        username: 'testuser',
        password: '123456'
      };
      
      const loginResponse = await axios.post(`${BASE_URL}/auth/login`, loginData);
      console.log('✅ 用户登录成功:', loginResponse.data.data.user.username);
      console.log('   角色:', loginResponse.data.data.user.role, '\n');
      
      // 5. 测试获取用户信息
      console.log('5. 测试获取用户信息...');
      const profileResponse = await axios.get(`${BASE_URL}/auth/profile`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      console.log('✅ 获取用户信息成功:', profileResponse.data.data.username);
      console.log('   邮箱:', profileResponse.data.data.email);
      console.log('   创建时间:', profileResponse.data.data.created_at, '\n');
      
    } catch (registerError) {
      if (registerError.response && registerError.response.data.message.includes('已存在')) {
        console.log('ℹ️  用户已存在，跳过注册测试\n');
        
        // 直接测试登录
        console.log('4. 测试用户登录...');
        const loginData = {
          username: 'testuser',
          password: '123456'
        };
        
        const loginResponse = await axios.post(`${BASE_URL}/auth/login`, loginData);
        console.log('✅ 用户登录成功:', loginResponse.data.data.user.username, '\n');
      } else {
        throw registerError;
      }
    }

    // 6. 测试武器列表
    console.log('6. 测试武器列表...');
    const weaponsResponse = await axios.get(`${BASE_URL}/weapons`);
    console.log('✅ 获取武器列表成功');
    console.log('   武器数量:', weaponsResponse.data.data.weapons.length);
    console.log('   总页数:', weaponsResponse.data.data.pagination.total_pages);
    
    if (weaponsResponse.data.data.weapons.length > 0) {
      const firstWeapon = weaponsResponse.data.data.weapons[0];
      console.log('   示例武器:', firstWeapon.name, `(${firstWeapon.type}, ${firstWeapon.country})`);
      
      // 7. 测试武器详情
      console.log('\n7. 测试武器详情...');
      const weaponDetailResponse = await axios.get(`${BASE_URL}/weapons/${firstWeapon.id}`);
      console.log('✅ 获取武器详情成功:', weaponDetailResponse.data.data.name);
      console.log('   描述:', weaponDetailResponse.data.data.description.substring(0, 50) + '...');
      
      // 8. 测试相似武器
      console.log('\n8. 测试相似武器...');
      const similarResponse = await axios.get(`${BASE_URL}/weapons/${firstWeapon.id}/similar`);
      console.log('✅ 获取相似武器成功');
      console.log('   相似武器数量:', similarResponse.data.data.similar_weapons.length);
    }

    // 9. 测试武器搜索
    console.log('\n9. 测试武器搜索...');
    const searchResponse = await axios.get(`${BASE_URL}/weapons/search?q=AK`);
    console.log('✅ 武器搜索成功');
    console.log('   搜索结果数量:', searchResponse.data.data.weapons.length);

    // 10. 测试武器统计
    console.log('\n10. 测试武器统计...');
    const statsResponse = await axios.get(`${BASE_URL}/weapons/statistics`);
    console.log('✅ 获取武器统计成功');
    console.log('   总武器数量:', statsResponse.data.data.total_weapons);
    console.log('   武器类型数量:', statsResponse.data.data.by_type.length);
    console.log('   制造国家数量:', statsResponse.data.data.by_country.length);

    console.log('\n🎉 所有API测试通过！后端服务运行正常。');
    
  } catch (error) {
    console.error('❌ API测试失败:', error.response ? error.response.data : error.message);
    if (error.response) {
      console.error('   状态码:', error.response.status);
      console.error('   错误详情:', error.response.data);
    }
  }
}

// 延迟执行，等待服务器启动
setTimeout(testAPI, 2000);