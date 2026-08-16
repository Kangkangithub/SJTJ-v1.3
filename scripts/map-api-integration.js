// ==================== 地图API集成模块 ====================
// 功能：提供地图可视化所需的国家数据API接口

window.mapApiIntegration = {
    // 获取国家数据
    async getCountries() {
        try {
            // 首先尝试从本地JSON文件获取
            const response = await fetch('./data/countries.json');
            if (response.ok) {
                const data = await response.json();
                return data;
            }
            
            // 如果本地文件不可用，返回模拟数据
            return this.getMockCountryData();
        } catch (error) {
            console.error('获取国家数据失败:', error);
            // 返回模拟数据作为后备方案
            return this.getMockCountryData();
        }
    },
    
    // 获取地图数据
    async getMapData() {
        try {
            // 使用在线TopoJSON数据源
            const response = await fetch('https://cdn.jsdelivr.net/npm/world-atlas@1/world-110m.json');
            if (response.ok) {
                return await response.json();
            }
            
            // 备用数据源
            const response2 = await fetch('https://unpkg.com/world-atlas@1.1.4/world-110m.json');
            if (response2.ok) {
                return await response2.json();
            }
            
            throw new Error('无法加载地图数据');
        } catch (error) {
            console.error('获取地图数据失败:', error);
            throw error;
        }
    },
    
    // 模拟国家数据（当API不可用时使用）
    getMockCountryData() {
        return [
            { id: 1, name: '美国', code: 'US' },
            { id: 2, name: '俄罗斯', code: 'RU' },
            { id: 3, name: '中国', code: 'CN' },
            { id: 4, name: '德国', code: 'DE' },
            { id: 5, name: '法国', code: 'FR' },
            { id: 6, name: '英国', code: 'GB' },
            { id: 7, name: '以色列', code: 'IL' },
            { id: 8, name: '瑞典', code: 'SE' },
            { id: 9, name: '意大利', code: 'IT' },
            { id: 10, name: '日本', code: 'JP' },
            { id: 11, name: '奥地利', code: 'AT' },
            { id: 460, name: '西班牙', code: 'ES' },
            { id: 1198, name: '比利时', code: 'BE' },
            { id: 1474, name: '土耳其', code: 'TR' },
            { id: 1508, name: '乌克兰', code: 'UA' },
            { id: 1520, name: '澳大利亚', code: 'AU' },
            { id: 1631, name: '新西兰', code: 'NZ' }
        ];
    },
    
    // 根据国家名称获取武器数据
    async getWeaponsByCountry(countryName) {
        try {
            const response = await fetch(`http://localhost:3001/api/herbs?region=${encodeURIComponent(countryName)}`);
            if (response.ok) {
                const result = await response.json();
                if (result.success) {
                    return result.data.weapons || [];
                }
            }
            return [];
        } catch (error) {
            console.error('获取国家武器数据失败:', error);
            return [];
        }
    },
    
    // 获取国家与武器的关系数据
    async getCountryWeaponRelations() {
        try {
            const response = await fetch('http://localhost:3001/api/knowledge/country-weapons');
            if (response.ok) {
                const result = await response.json();
                if (result.success) {
                    return result.data;
                }
            }
            return this.getMockCountryWeaponRelations();
        } catch (error) {
            console.error('获取国家武器关系失败:', error);
            return this.getMockCountryWeaponRelations();
        }
    },
    
    // 模拟国家武器关系数据
    getMockCountryWeaponRelations() {
        return {
            '中国': ['95式自动步枪', '99式主战坦克', '歼-20战斗机'],
            '美国': ['M16步枪', 'M1艾布拉姆斯坦克', 'F-22猛禽战斗机'],
            '俄罗斯': ['AK-47步枪', 'T-90坦克', '苏-57战斗机'],
            '德国': ['G36步枪', '豹2坦克', '台风战斗机'],
            '法国': ['FAMAS步枪', '勒克莱尔坦克', '阵风战斗机']
        };
    },
    
    // 获取武器-国家关联数据
    async getWeaponCountryRelations() {
        try {
            const response = await fetch('http://localhost:3001/api/knowledge/weapon-countries');
            if (response.ok) {
                const result = await response.json();
                if (result.success) {
                    return result.data;
                }
            }
            return this.getMockWeaponCountryRelations();
        } catch (error) {
            console.error('获取武器-国家关联数据失败:', error);
            return this.getMockWeaponCountryRelations();
        }
    },
    
    // 模拟武器-国家关联数据
    getMockWeaponCountryRelations() {
        return [
            { weapon_id: 1, country_id: 3, weapon_name: '95式自动步枪', country_name: '中国' },
            { weapon_id: 2, country_id: 1, weapon_name: 'M16步枪', country_name: '美国' },
            { weapon_id: 3, country_id: 2, weapon_name: 'AK-47步枪', country_name: '俄罗斯' },
            { weapon_id: 4, country_id: 4, weapon_name: 'G36步枪', country_name: '德国' },
            { weapon_id: 5, country_id: 5, weapon_name: 'FAMAS步枪', country_name: '法国' },
            { weapon_id: 6, country_id: 3, weapon_name: '99式主战坦克', country_name: '中国' },
            { weapon_id: 7, country_id: 1, weapon_name: 'M1艾布拉姆斯坦克', country_name: '美国' },
            { weapon_id: 8, country_id: 2, weapon_name: 'T-90坦克', country_name: '俄罗斯' },
            { weapon_id: 9, country_id: 4, weapon_name: '豹2坦克', country_name: '德国' },
            { weapon_id: 10, country_id: 5, weapon_name: '勒克莱尔坦克', country_name: '法国' }
        ];
    }
};

console.log('地图API集成模块已加载');